import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  auth,
  db,
  logout,
  handleFirestoreError,
  OperationType,
} from "./lib/firebase";
import {
  extractExpenseFromImage,
  extractExpenseFromEmail,
} from "./services/gemini";
import { fetchRecentReceiptEmails } from "./services/gmail";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";

import { COMMON_CURRENCIES, DEFAULT_CATEGORIES } from "./constants";
import { formatCurrency, convertCurrency } from "./lib/utils";
import { Expense, UserProfile } from "./types";

import { ExpenseItem } from "./components/ExpenseItem";
import { LoadingScreen } from "./components/LoadingScreen";
import { AuthScreen } from "./components/AuthScreen";

ChartJS.register(ArcElement, Tooltip, Legend);

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const expensesRef = useRef<Expense[]>([]);
  useEffect(() => {
    expensesRef.current = expenses;
  }, [expenses]);
  const convertingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile || profile.autoConvertCurrency === false) return;

    const convertOldExpenses = async () => {
      const primaryCurrency = profile.currency || "TRY";

      const toConvert = expenses.filter((e) => {
        if (convertingRef.current.has(e.id)) return false;
        // Case 1: currency is not primary
        if (e.currency !== primaryCurrency) return true;
        // Case 2: previously synced incorrectly (amo equals originalAmount but they had foreign originalCurrency)
        if (e.originalCurrency && e.originalAmount && e.originalAmount === e.amount && e.originalCurrency !== primaryCurrency) {
          return true;
        }
        return false;
      });

      if (toConvert.length === 0) return;

      for (const expense of toConvert) {
        convertingRef.current.add(expense.id);
        try {
          const actualOriginalAmount = expense.originalAmount || expense.amount;
          const actualFromCurrency = (expense.originalCurrency && expense.originalCurrency !== expense.currency) ? expense.originalCurrency : expense.currency;

          const newAmount = await convertCurrency(
            actualOriginalAmount,
            actualFromCurrency,
            primaryCurrency,
            expense.date
          );
          if (newAmount === actualOriginalAmount && actualFromCurrency !== primaryCurrency) {
            console.error("Conversion probably failed, skipping update for " + expense.id);
            convertingRef.current.delete(expense.id);
            continue;
          }
          await updateDoc(doc(db, "expenses", expense.id), {
            amount: newAmount,
            currency: primaryCurrency,
            originalAmount: actualOriginalAmount,
            originalCurrency: actualFromCurrency,
          });
        } catch (e) {
          console.error("Failed to convert old expense", e);
          convertingRef.current.delete(expense.id);
        }
      }
    };

    convertOldExpenses();
  }, [profile, expenses]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "expenses" | "insights" | "settings"
  >("dashboard");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    let unsubExpenses: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (unsubExpenses) {
        unsubExpenses();
      }
      setUser(u);
      if (u) {
        // Fetch/Create Profile
        const docRef = doc(db, "users", u.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || "",
              displayName: u.displayName || "User",
              photoURL: u.photoURL || undefined,
              isCorporate: false,
              monthlyIncome: 0,
              currency: "TRY",
              categories: DEFAULT_CATEGORIES,
              syncLabels: "",
              syncFrequency: "6months",
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (e) {
          console.error("Profile fetch/create failed:", e);
        }

        // Fetch Expenses
        const q = query(
          collection(db, "expenses"),
          where("userId", "==", u.uid),
          orderBy("date", "desc"),
        );

        unsubExpenses = onSnapshot(
          q,
          (snapshot) => {
            setExpenses(
              snapshot.docs.map(
                (doc) => ({ id: doc.id, ...doc.data() }) as Expense,
              ),
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "expenses"),
        );

        setLoading(false);
      } else {
        setExpenses([]);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubExpenses) unsubExpenses();
    };
  }, []);

  const [syncingEmails, setSyncingEmails] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  const handleSyncEmails = async (background = false) => {
    if (!background) {
      setSyncingEmails(true);
      setSyncMessage("Gmail'e bağlanılıyor...");
    }
    try {
      const emails = await fetchRecentReceiptEmails(
        {
          frequency: profile?.syncFrequency || "6months",
          folder: profile?.syncLabels || "",
          background,
        },
        () => {
          if (!background)
            setSyncMessage("Gmail ile bağlandı. Faturalar aranıyor...");
        },
      );
      if (emails.length === 0) {
        setSyncMessage("Yeni fatura bulunamadı.");
        setTimeout(() => setSyncMessage(""), 3000);
        return;
      }
      setSyncMessage(`${emails.length} e-posta işleniyor...`);
      const cats = profile?.categories || DEFAULT_CATEGORIES;
      const processedIds = new Set(profile?.processedEmailIds || []);
      const newProcessedIds: string[] = [];
      let added = 0;
      let skipped = 0;

      const isLikelyReceipt = (subject: string, text: string) => {
        const lowerSubject = subject.toLowerCase();
        const lowerText = text.toLowerCase();

        const keywords = [
          "receipt",
          "invoice",
          "fatura",
          "order",
          "sipariş",
          "payment",
          "ödeme",
          "makbuz",
          "purchase",
          "ticket",
          "bilet",
        ];
        // Quick short-circuit if subject matches
        if (keywords.some((k) => lowerSubject.includes(k))) return true;
        // Or if the first chunk of text mentions it
        if (keywords.some((k) => lowerText.substring(0, 800).includes(k)))
          return true;

        return false;
      };

      for (const email of emails) {
        if (processedIds.has(email.id)) {
          skipped++;
          continue; // Already processed
        }

        if (
          !isLikelyReceipt(email.subject || "", email.text || "") &&
          (email.pdfAttachments?.length || 0) === 0
        ) {
          skipped++;
          // We will mark it as processed so we don't evaluate it again
          newProcessedIds.push(email.id);
          processedIds.add(email.id);
          if (profile) {
            const updatedProcessedIds = [
              ...(profile.processedEmailIds || []),
              email.id,
            ].slice(-1000);
            await setDoc(doc(db, "users", profile.uid), {
              ...profile,
              processedEmailIds: updatedProcessedIds,
            });
            profile.processedEmailIds = updatedProcessedIds;
          }
          continue; // Skip emails that clearly don't look like a receipt
        }

        try {
          const truncatedText = (email.text || "").substring(0, 15000);
          const extractedResults = await extractExpenseFromEmail(
            `Subject: ${email.subject || "No Subject"}\n\n${truncatedText}`,
            email.pdfAttachments || [],
            cats,
          );

          const seen = new Set();
          for (const extracted of extractedResults) {
            if (extracted && extracted.amount > 0) {
              const key = `${extracted.amount}-${extracted.merchant}-${extracted.date}`;
              if (seen.has(key)) continue;

              // Check if already in the DB to prevent duplicates
              const isDuplicate = expensesRef.current.some(
                (e) =>
                  e.amount ===
                    (typeof extracted.amount === "string"
                      ? parseFloat(extracted.amount)
                      : extracted.amount) &&
                  e.date === extracted.date &&
                  e.merchant.toLowerCase() ===
                    (extracted.merchant || "").toLowerCase(),
              );
              if (isDuplicate) {
                skipped++;
                continue;
              }

              seen.add(key);

              const extractedCurrency =
                extracted.currency || profile?.currency || "TRY";
              let extractedAmount =
                typeof extracted.amount === "string"
                  ? parseFloat(extracted.amount)
                  : extracted.amount;
              let finalAmount = extractedAmount;
              let finalCurrency = extractedCurrency;
              const primaryCurrency = profile?.currency || "TRY";

              const autoConvert = profile?.autoConvertCurrency ?? true;
              if (autoConvert && extractedCurrency !== primaryCurrency) {
                finalAmount = await convertCurrency(
                  extractedAmount,
                  extractedCurrency,
                  primaryCurrency,
                  extracted.date || format(new Date(), "yyyy-MM-dd")
                );
                finalCurrency = primaryCurrency;
              }

              const expensePayload: any = {
                userId: profile?.uid,
                emailId: email.id,
                amount: finalAmount,
                currency: finalCurrency,
                merchant: extracted.merchant || "Unknown",
                category: extracted.category || "Other",
                date: extracted.date || format(new Date(), "yyyy-MM-dd"),
                description: extracted.description || "E-posta Faturası",
                isCorporate: !!extracted.isCorporatePotential,
                createdAt: serverTimestamp(),
                syncStatus: "pending",
              };
              if (
                extractedCurrency !== primaryCurrency &&
                finalCurrency === primaryCurrency
              ) {
                expensePayload.originalAmount = extractedAmount;
                expensePayload.originalCurrency = extractedCurrency;
              }
              await addDoc(collection(db, "expenses"), expensePayload);
              added++;
            }
          }
          newProcessedIds.push(email.id); // Mark AI parse success
          processedIds.add(email.id);

          if (profile) {
            const updatedProcessedIds = [
              ...(profile.processedEmailIds || []),
              email.id,
            ].slice(-1000);
            await setDoc(doc(db, "users", profile.uid), {
              ...profile,
              processedEmailIds: updatedProcessedIds,
            });
            profile.processedEmailIds = updatedProcessedIds;
          }

          // AI Studio limits API calls. To prevent 429 Resource Exhausted, we must enforce a ~15 Requests Per Minute limit.
          await new Promise((resolve) => setTimeout(resolve, 6500));
        } catch (aiErr: any) {
          console.error("Email parsing error:", aiErr);
          const errMsg = aiErr?.message || "";
          if (
            errMsg.includes("429") ||
            errMsg.includes("quota") ||
            errMsg.includes("RESOURCE_EXHAUSTED")
          ) {
            throw new Error(
              "Yapay zeka API kota limitine ulaşıldı. Lütfen daha sonra tekrar senkronize edin.",
            );
          }
        }
      }

      if (profile && newProcessedIds.length > 0) {
        // Fallback or final update is handled incrementally now, but we can do one final flush if needed
        // Keep the last 1000 processed IDs to avoid blowing up the Firestore document size
        const currentStored = profile.processedEmailIds || [];
        if (newProcessedIds.some((id) => !currentStored.includes(id))) {
          const updatedProcessedIds = [
            ...new Set([...currentStored, ...newProcessedIds]),
          ].slice(-1000);
          await setDoc(doc(db, "users", profile.uid), {
            ...profile,
            processedEmailIds: updatedProcessedIds,
          });
          // Object mutation handles local state tracking for now
          profile.processedEmailIds = updatedProcessedIds;
        }
      }

      setSyncMessage(
        `${added} yeni işlem eklendi! ${skipped ? `(${skipped} ilgisiz/eski e-posta atlandı)` : ""}`,
      );
      setTimeout(() => setSyncMessage(""), 3000);
    } catch (e: any) {
      if (e.message === "INTERACTION_REQUIRED") {
        setSyncingEmails(false);
        setSyncMessage("");
        return;
      }
      const isPopupClosed = e?.message?.includes("popup-closed");
      if (!isPopupClosed) {
        console.error(e);
      }
      let errMsg =
        e.message || "Senkronizasyon başarısız. İzinleri kontrol edin.";
      if (isPopupClosed) {
        errMsg = "Erişim verilmedi veya işlem iptal edildi.";
      } else if (errMsg.includes("Gmail API has not been used")) {
        errMsg =
          "Gmail API kapalı. Google Cloud Console'dan Gmail API'yi etkinleştirin.";
      }
      setSyncMessage(errMsg);
      setTimeout(() => setSyncMessage(""), 8000);
    } finally {
      setSyncingEmails(false);
    }
  };

  useEffect(() => {
    if (profile && expenses.length >= 0 && !hasAutoSynced) {
      setHasAutoSynced(true);
      handleSyncEmails(true);
    }
  }, [profile, hasAutoSynced, expenses.length]);

  useEffect(() => {
    if (!profile) {
      setHasAutoSynced(false);
    }
  }, [profile]);

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  const activeExpenses = expenses.filter((e) => e.syncStatus !== "pending");
  const pendingExpenses = expenses.filter((e) => e.syncStatus === "pending");

  return (
    <div className="min-h-screen flex flex-col antialiased">
      {/* TopAppBar */}
      <header className="bg-surface text-primary shadow-sm flex justify-between items-center px-4 sm:px-6 h-16 w-full z-50 sticky top-0 shadow-[0px_4px_12px_rgba(13,71,161,0.05)]">
        <button className="text-primary hover:bg-surface-container-high transition-colors active:scale-95 duration-200 p-2 rounded-full flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined">
            account_balance_wallet
          </span>
        </button>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tight text-center">
          Lira
        </h1>
        <button className="text-primary hover:bg-surface-container-high transition-colors active:scale-95 duration-200 p-2 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
          <span className="material-symbols-outlined">notifications_none</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 sm:px-6 py-6 pb-32 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <Dashboard
              profile={profile}
              expenses={activeExpenses}
              setActiveTab={setActiveTab}
              key="dashboard"
            />
          )}
          {activeTab === "expenses" && (
            <ExpenseListView
              expenses={activeExpenses}
              profile={profile}
              key="expenses"
            />
          )}
          {activeTab === "insights" && (
            <SyncView
              profile={profile}
              pendingExpenses={pendingExpenses}
              allExpenses={expenses}
              syncingEmails={syncingEmails}
              syncMessage={syncMessage}
              handleSyncEmails={handleSyncEmails}
              key="sync"
            />
          )}
          {activeTab === "settings" && (
            <SettingsView profile={profile} key="settings" />
          )}
        </AnimatePresence>
      </main>

      {/* BottomNavBar */}
      <nav className="bg-surface-container-lowest text-primary shadow-[0px_-4px_12px_rgba(13,71,161,0.05)] fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-4 py-4 rounded-t-xl sm:hidden">
        <NavButton
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
          icon="home"
          label="Ana Sayfa"
        />
        <NavButton
          active={activeTab === "expenses"}
          onClick={() => setActiveTab("expenses")}
          icon="receipt_long"
          label="Liste"
        />
        <NavButton
          active={false}
          onClick={() => setIsAddModalOpen(true)}
          icon="add_a_photo"
          label="Tara"
        />
        <NavButton
          active={activeTab === "insights"}
          onClick={() => setActiveTab("insights")}
          icon="sync"
          label="YZ / Senkronize"
        />
        <NavButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          icon="person"
          label="Ayarlar"
        />
      </nav>

      {/* Desktop sidebar-like floating nav (optional fallback) */}
      <nav className="hidden sm:flex fixed bottom-8 left-1/2 -translate-x-1/2 h-16 bg-surface-container-lowest rounded-[2rem] border border-surface-variant px-6 items-center gap-4 z-40 shadow-[0px_4px_12px_rgba(13,71,161,0.05)]">
        <NavButton
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
          icon="home"
          label="Ana Sayfa"
        />
        <NavButton
          active={activeTab === "expenses"}
          onClick={() => setActiveTab("expenses")}
          icon="receipt_long"
          label="Liste"
        />
        <NavButton
          active={false}
          onClick={() => setIsAddModalOpen(true)}
          icon="add_a_photo"
          label="Tara"
        />
        <NavButton
          active={activeTab === "insights"}
          onClick={() => setActiveTab("insights")}
          icon="sync"
          label="YZ / Senkronize"
        />
        <NavButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          icon="person"
          label="Ayarlar"
        />
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddExpenseModal
            onClose={() => setIsAddModalOpen(false)}
            userId={user.uid}
            profile={profile}
            isCorporateDefault={profile?.isCorporate || false}
            categories={profile?.categories || DEFAULT_CATEGORIES}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Components ---

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center px-4 py-1 hover:bg-surface-container-low transition-all active:scale-90 duration-200 ${active ? "text-primary bg-secondary-container/20 rounded-xl" : "text-on-surface-variant"}`}
    >
      <span
        className={`material-symbols-outlined text-[24px] ${active ? "filled" : ""}`}
      >
        {icon}
      </span>
      <span className="font-label-md text-label-md mt-1">{label}</span>
    </button>
  );
}

function Dashboard({
  profile,
  expenses,
  setActiveTab,
}: {
  profile: UserProfile | null;
  expenses: Expense[];
  setActiveTab: (tab: any) => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);

  const targetMonthDate = new Date();
  targetMonthDate.setMonth(targetMonthDate.getMonth() + monthOffset);

  const currentMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getMonth() === targetMonthDate.getMonth() &&
      d.getFullYear() === targetMonthDate.getFullYear()
    );
  });

  const totalSpent = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = (profile?.monthlyIncome || 0) - totalSpent;
  const corporateExpenses = currentMonthExpenses.filter((e) => e.isCorporate);

  const categoryData = currentMonthExpenses.reduce((acc: any, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  useEffect(() => {
    const checkRecurring = async () => {
      if (!profile || expenses.length === 0) return;
      const today = new Date().toISOString().split("T")[0];
      const recurring = expenses.filter(
        (e) =>
          e.isRecurring &&
          e.nextRecurrenceDate &&
          e.nextRecurrenceDate <= today,
      );

      for (const rec of recurring) {
        if (!rec.nextRecurrenceDate) continue;
        try {
          // Generate new occurrence
          await addDoc(collection(db, "expenses"), {
            userId: profile.uid,
            amount: rec.amount,
            currency: rec.currency || "TRY",
            merchant: rec.merchant,
            category: rec.category,
            date: rec.nextRecurrenceDate,
            description: rec.description || `Düzenli İşlem (${rec.merchant})`,
            isCorporate: rec.isCorporate,
            createdAt: serverTimestamp(),
            parentId: rec.id,
          });

          // Update the parent
          let nextDate = new Date(rec.nextRecurrenceDate);
          if (rec.recurrenceInterval === "monthly") {
            nextDate.setMonth(nextDate.getMonth() + 1);
          } else if (rec.recurrenceInterval === "weekly") {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (rec.recurrenceInterval === "yearly") {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
          } else {
            nextDate.setMonth(nextDate.getMonth() + 1); // default fallback
          }

          await updateDoc(doc(db, "expenses", rec.id), {
            nextRecurrenceDate: nextDate.toISOString().split("T")[0],
          });
        } catch (e) {
          console.error("Failed to process recurrence: ", e);
        }
      }
    };
    checkRecurring();
  }, [profile, expenses]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      className="space-y-xl"
    >
      {/* Balance Card */}
      <div className="bg-primary border border-primary-container rounded-xl p-6 relative overflow-hidden shadow-[0px_8px_24px_rgba(13,71,161,0.15)]">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <span className="material-symbols-outlined text-[80px]">
            pie_chart
          </span>
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="font-label-md text-label-md text-on-primary-container uppercase tracking-wider mb-2">
                Aylık Bütçe
              </p>
              <h2 className="font-display-lg text-display-lg text-on-primary">
                {formatCurrency(
                  profile?.monthlyIncome || 0,
                  profile?.currency || "TRY",
                )}
              </h2>
            </div>
            <div className="flex bg-surface-container-lowest/20 rounded-full p-1 border border-white/20 backdrop-blur-sm shadow-sm">
              <button
                onClick={() => setMonthOffset((prev) => prev - 1)}
                disabled={monthOffset === -11}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-90 ${monthOffset === -11 ? "text-white/30 cursor-not-allowed" : "text-white hover:bg-white/20"}`}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <div className="px-3 flex items-center justify-center min-w-[100px] font-label-md text-label-md text-white capitalize">
                {format(targetMonthDate, "MMMM yyyy", { locale: tr })}
              </div>
              <button
                onClick={() => setMonthOffset((prev) => prev + 1)}
                disabled={monthOffset === 0}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-90 ${monthOffset === 0 ? "text-white/30 cursor-not-allowed" : "text-white hover:bg-white/20"}`}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-surface-container-lowest/10 rounded-lg border border-white/10 backdrop-blur-sm">
              <div className="flex justify-between font-label-md text-label-md mb-2">
                <span className="text-on-primary-container">
                  Harcanan
                  {profile?.monthlyIncome
                    ? ` (${((totalSpent / profile.monthlyIncome) * 100).toFixed(0)}%)`
                    : ""}
                </span>
                <span className="font-bold text-white">
                  {formatCurrency(totalSpent, profile?.currency || "TRY")}
                </span>
              </div>
              <div className="w-full bg-surface-container-lowest/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-error h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(profile?.monthlyIncome ? (totalSpent / profile.monthlyIncome) * 100 : 0, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="p-4 bg-surface-container-lowest/10 rounded-lg border border-white/10 backdrop-blur-sm">
              <div className="flex justify-between font-label-md text-label-md mb-2">
                <span className="text-on-primary-container">Kalan</span>
                <span className="font-bold text-white">
                  {formatCurrency(remaining, profile?.currency || "TRY")}
                </span>
              </div>
              <div className="w-full bg-surface-container-lowest/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-tertiary-fixed h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(profile?.monthlyIncome ? (remaining / profile.monthlyIncome) * 100 : 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_4px_12px_rgba(13,71,161,0.05)] border border-surface-variant">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Harcama Analizi
            </h3>
            <p className="font-body-sm text-body-sm text-outline capitalize">
              {format(targetMonthDate, "MMMM yyyy", { locale: tr })} Özeti
            </p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-surface-container rounded-full font-label-md text-label-md text-on-surface-variant">
              Tümü
            </div>
          </div>
        </div>
        <div className="h-48 mb-lg flex items-center justify-center px-2">
          {Object.keys(categoryData).length > 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
              className="w-full h-full"
              key={JSON.stringify(categoryData)}
            >
              <Pie
                data={{
                  labels: Object.keys(categoryData),
                  datasets: [
                    {
                      data: Object.values(categoryData),
                      backgroundColor: [
                        "#006099",
                        "#2e79b5",
                        "#496079",
                        "#8a4d00",
                        "#ba1a1a",
                        "#01629d",
                      ],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  plugins: { legend: { display: false } },
                  maintainAspectRatio: false,
                  animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1000,
                    easing: "easeOutExpo",
                  },
                }}
              />
            </motion.div>
          ) : (
            <p className="font-body-sm text-body-sm text-outline text-center w-full">
              Henüz veri yok. İşlem ekleyin.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(categoryData)
            .slice(0, 4)
            .map(([cat, val]: any, i) => {
              const budget = profile?.budgets?.[cat];
              const pct = budget ? Math.min((val / budget) * 100, 100) : 0;
              return (
                <div
                  key={cat}
                  className="bg-surface-container rounded-lg p-4 border border-surface-variant flex flex-col justify-between"
                >
                  <div>
                    <span className="font-label-md text-label-md text-on-surface-variant block mb-1 uppercase tracking-wider">
                      Kategori {i + 1}
                    </span>
                    <div className="flex justify-between items-center">
                      <span
                        className="font-body-md text-body-md font-medium text-on-surface truncate mr-2"
                        title={cat}
                      >
                        {cat}
                      </span>
                      <span className="font-label-md text-label-md text-primary">
                        {formatCurrency(val, profile?.currency || "TRY")}{" "}
                        {budget
                          ? `/ ${formatCurrency(budget, profile?.currency || "TRY")}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  {budget ? (
                    <div className="w-full bg-surface-container-high rounded-full h-2 mt-3">
                      <div
                        className={`h-2 rounded-full ${pct > 90 ? "bg-error" : pct > 75 ? "bg-tertiary" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      </div>

      {/* Corporate Summary */}
      {profile?.isCorporate && (
        <div className="bg-tertiary-container/10 border border-tertiary/20 rounded-xl p-6 shadow-[0px_4px_12px_rgba(13,71,161,0.05)]">
          <h3 className="text-tertiary font-label-md text-label-md uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              business_center
            </span>{" "}
            YZ Vergi Analizi
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-4">
            Bu ay {corporateExpenses.length} adet kurumsal işleminiz var.
            Potansiyel vergi indirimi:{" "}
            <span className="font-body-md text-body-md font-bold text-on-surface">
              {formatCurrency(
                corporateExpenses.reduce((s, e) => s + e.amount, 0),
                profile?.currency || "TRY",
              )}
            </span>
          </p>
          <button
            onClick={() => setActiveTab("insights")}
            className="w-full py-3 bg-surface-container-lowest border border-surface-variant hover:bg-surface-container-low text-on-surface rounded-lg font-label-md text-label-md transition-colors active:scale-95 shadow-sm"
          >
            Vergi Öngörülerini Gör
          </button>
        </div>
      )}

      {/* Recent List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          İşlemler
        </h3>
        <div className="space-y-4">
          {currentMonthExpenses.length > 0 ? (
            currentMonthExpenses
              .slice(0, 5)
              .map((exp) => <ExpenseItem key={exp.id} expense={exp} />)
          ) : (
            <p className="text-sm text-slate-500">Bu ay hiç işlem yok.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ExpenseListView({
  expenses,
  profile,
}: {
  expenses: Expense[];
  profile: UserProfile | null;
}) {
  const [filterType, setFilterType] = useState<
    "All" | "Personal" | "Corporate"
  >("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredExpenses = expenses
    .filter((exp) => {
      if (filterType === "Personal" && exp.isCorporate) return false;
      if (filterType === "Corporate" && !exp.isCorporate) return false;

      if (filterCategory !== "All" && exp.category !== filterCategory)
        return false;

      if (dateFrom && exp.date < dateFrom) return false;
      if (dateTo && exp.date > dateTo) return false;

      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB === timeA) {
        return (
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
      }
      return timeB - timeA;
    });

  // UI level deduplication for existing duplicates in the database
  const seenIds = new Set<string>();
  const deduplicatedFilteredExpenses = filteredExpenses.filter((e) => {
    const identifier = `${e.amount}-${e.merchant?.toLowerCase()}-${e.date}`;
    if (seenIds.has(identifier)) return false;
    seenIds.add(identifier);
    return true;
  });

  const categories = profile?.categories || DEFAULT_CATEGORIES;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4">
        {/* Search Bar - Simulated conceptually matching the design */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl py-3 pl-12 pr-4 font-body-md text-on-surface focus:outline-none focus:border-primary shadow-sm transition-all"
            placeholder="Search transactions..."
            type="text"
            // Note: implementing search functionality is a bonus, leaving as placeholder for styling purposes
          />
        </div>

        {/* Filters array like the design */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setFilterType("All")}
            className={`flex items-center gap-2 border border-surface-variant rounded-full px-4 py-2 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === "All" ? "bg-primary-fixed text-on-primary-fixed border-transparent" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              filter_list
            </span>
            <span className="font-label-md">Tümü</span>
          </button>
          <button
            onClick={() => setFilterType("Personal")}
            className={`flex items-center gap-2 border border-surface-variant rounded-full px-4 py-2 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === "Personal" ? "bg-primary-fixed text-on-primary-fixed border-transparent" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              person
            </span>
            <span className="font-label-md">Kişisel</span>
          </button>
          <button
            onClick={() => setFilterType("Corporate")}
            className={`flex items-center gap-2 border border-surface-variant rounded-full px-4 py-2 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === "Corporate" ? "bg-primary-fixed text-on-primary-fixed border-transparent" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              business
            </span>
            <span className="font-label-md">İş</span>
          </button>

          <div className="flex items-center justify-center border-l border-surface-variant pl-4 ml-2 gap-2 shrink-0">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-surface-container-lowest border border-surface-variant rounded-lg p-1 text-xs text-on-surface outline-none focus:border-primary h-8"
            />
            <span className="text-outline text-xs">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-surface-container-lowest border border-surface-variant rounded-lg p-1 text-xs text-on-surface outline-none focus:border-primary h-8"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-surface-container-lowest border border-surface-variant rounded-lg p-1 text-xs text-on-surface outline-none focus:border-primary h-8 max-w-[100px]"
            >
              <option value="All">Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-[0px_4px_12px_rgba(13,71,161,0.05)] overflow-hidden">
        {deduplicatedFilteredExpenses.length === 0 && (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-[48px] text-surface-dim mb-4">
              receipt_long
            </span>
            <p className="font-body-md text-on-surface-variant">
              Filtrelerinizle eşleşen işlem yok.
            </p>
          </div>
        )}
        {deduplicatedFilteredExpenses.map((exp) => (
          <ExpenseItem key={exp.id} expense={exp} detail />
        ))}
      </div>
    </motion.div>
  );
}

function SyncView({
  profile,
  pendingExpenses,
  allExpenses,
  syncingEmails,
  syncMessage,
  handleSyncEmails,
}: {
  profile: UserProfile | null;
  pendingExpenses: Expense[];
  allExpenses: Expense[];
  syncingEmails: boolean;
  syncMessage: string;
  handleSyncEmails: () => void;
}) {
  const handleConfirm = async (e: Expense) => {
    try {
      await updateDoc(doc(db, "expenses", e.id), { syncStatus: "confirmed" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "expenses");
    }
  };

  const handleReview = (e: Expense) => {
    handleConfirm(e);
  };

  const deletePendingEmails = async () => {
    if (!profile) return;
    if (
      confirm(
        "Sadece E-posta'dan okunan harcamalar silinecek. Onaylıyor musunuz?",
      )
    ) {
      try {
        const emailExpenses = allExpenses.filter((e) => e.emailId);
        if (emailExpenses.length === 0) {
          alert("Silinecek e-posta harcaması bulunamadı.");
          return;
        }

        const batch = writeBatch(db);
        for (const exp of emailExpenses) {
          batch.delete(doc(db, "expenses", exp.id));
        }

        const userRef = doc(db, "users", profile.uid);
        batch.update(userRef, { processedEmailIds: [] });

        await batch.commit();
        alert(
          "E-posta harcamaları kaldırıldı ve e-posta okuma geçmişi sıfırlandı.",
        );
      } catch (e: any) {
        handleFirestoreError(e, OperationType.DELETE, "expenses");
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6 pt-4 pb-20"
    >
      <div className="bg-surface border border-surface-variant rounded-xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-secondary-container/10 border border-secondary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary">
              mail
            </span>
          </div>
          <div className="flex-grow">
            <h3 className="font-label-lg font-bold text-on-surface">
              Bağlı Hesap
            </h3>
            <p className="font-body-md text-on-surface-variant">
              {profile?.email || "Kullanıcı Bulunamadı"}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-secondary text-sm cursor-pointer hover:underline">
                Değiştir
              </span>
              <span className="text-on-surface-variant text-sm flex items-center before:content-[''] before:w-2 before:h-2 before:bg-tertiary-fixed before:rounded-full before:mr-2">
                Aktif Bağlantı
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <button
            onClick={handleSyncEmails}
            disabled={syncingEmails}
            className="px-6 py-2.5 bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white rounded-lg font-label-md transition-colors disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 w-max"
          >
            <span
              className={
                "material-symbols-outlined" +
                (syncingEmails ? " animate-spin" : "")
              }
            >
              sync
            </span>
            {syncingEmails ? "Senkronize Ediliyor..." : "Şimdi Senkronize Et"}
          </button>
          <button
            onClick={deletePendingEmails}
            className="px-6 py-2.5 bg-error/10 hover:bg-error/20 text-error rounded-lg font-label-md transition-colors active:scale-95 flex items-center justify-center gap-2 w-max"
          >
            <span className="material-symbols-outlined">delete</span>
            E-posta Harcamalarını Sıfırla
          </button>
        </div>
        <p className="text-sm text-on-surface-variant mt-2">
          {syncMessage || "Senkronizasyon bekleniyor..."}
        </p>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4 px-1">
          <div>
            <h2 className="font-display-sm text-on-surface font-semibold">
              Taranan E-Faturalar
            </h2>
            <p className="font-body-sm text-on-surface-variant">
              Gmail'den son okunan faturalar.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {pendingExpenses.length === 0 ? (
            <div className="p-8 text-center bg-surface border border-surface-variant rounded-xl text-on-surface-variant text-sm flex flex-col items-center">
              <span className="material-symbols-outlined text-[48px] text-surface-dim mb-4">
                inbox
              </span>
              Bekleyen yeni e-fatura bulunamadı.
            </div>
          ) : (
            pendingExpenses.map((e) => (
              <div
                key={e.id}
                className="bg-surface border border-surface-variant rounded-xl p-5 shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-container border border-surface-variant flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {e.category === "Ulaşım"
                          ? "directions_car"
                          : e.category === "Yemek"
                            ? "restaurant"
                            : e.category === "Alışveriş"
                              ? "storefront"
                              : "receipt_long"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-label-lg font-bold text-on-surface">
                        {e.merchant}
                      </h4>
                      <p className="font-body-sm text-on-surface-variant">
                        {format(new Date(e.date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display-md font-bold text-on-surface">
                      {formatCurrency(e.amount, e.currency || "TRY")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleReview(e)}
                    className="py-2.5 rounded-lg border border-surface-variant text-on-surface hover:bg-surface-container transition-colors font-label-md cursor-pointer flex justify-center items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      edit
                    </span>
                    İncele
                  </button>
                  <button
                    onClick={() => handleConfirm(e)}
                    className="py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors font-label-md cursor-pointer flex justify-center items-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      check
                    </span>
                    Onayla
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SettingsView({ profile }: { profile: UserProfile | null }) {
  const [darkMode, setDarkMode] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [biometric, setBiometric] = useState(true);

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editPhoneValue, setEditPhoneValue] = useState("");

  const [isEditingCurrency, setIsEditingCurrency] = useState(false);
  const [editCurrencyValue, setEditCurrencyValue] = useState("");

  const startEditCurrency = () => {
    setEditCurrencyValue(profile?.currency || "TRY");
    setIsEditingCurrency(true);
  };

  const saveCurrency = async () => {
    setIsEditingCurrency(false);
    if (
      editCurrencyValue &&
      editCurrencyValue !== profile?.currency &&
      auth.currentUser
    ) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        currency: editCurrencyValue,
      });
    }
  };

  const toggleAutoConvert = async () => {
    if (auth.currentUser) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        autoConvertCurrency:
          profile?.autoConvertCurrency === undefined
            ? false
            : !profile.autoConvertCurrency,
      });
    }
  };

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  const startEditName = () => {
    setEditNameValue(profile?.displayName || "");
    setIsEditingName(true);
  };

  const saveName = async () => {
    setIsEditingName(false);
    if (
      editNameValue &&
      editNameValue !== profile?.displayName &&
      auth.currentUser
    ) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        displayName: editNameValue,
      });
    }
  };

  const startEditPhone = () => {
    setEditPhoneValue(profile?.phone || "+90 555 123 4567");
    setIsEditingPhone(true);
  };

  const savePhone = async () => {
    setIsEditingPhone(false);
    if (
      editPhoneValue &&
      editPhoneValue !== profile?.phone &&
      auth.currentUser
    ) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        phone: editPhoneValue,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="pb-24 pt-2 px-4 max-w-lg mx-auto w-full bg-[#f8fafc] dark:bg-surface min-h-[calc(100vh-60px)] font-sans"
    >
      {/* Profile Image & Name */}
      <div className="flex flex-col items-center pt-6 pb-6">
        <div className="w-[88px] h-[88px] rounded-full overflow-hidden mb-3 shadow-[0px_4px_16px_rgba(13,71,161,0.15)] border-2 border-white dark:border-surface-variant bg-slate-100 dark:bg-surface-container relative">
          {profile?.photoURL ? (
            <img
              src={profile?.photoURL}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="material-symbols-outlined text-[64px] text-slate-400 dark:text-outline absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              account_circle
            </span>
          )}
        </div>
        <h2 className="text-[17px] font-bold text-[#1e293b] dark:text-on-surface mb-[2px]">
          {profile?.displayName || "Ahmet Yılmaz"}
        </h2>
        <p className="text-[13px] text-slate-500 dark:text-on-surface-variant font-normal">
          Member since Jan 2023
        </p>
      </div>

      <div className="space-y-[18px]">
        {/* PERSONAL INFORMATION */}
        <section className="bg-white dark:bg-surface-container rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-surface-variant">
          <h3 className="text-[11px] font-bold text-[#0D47A1] dark:text-primary uppercase tracking-[0.08em] mb-[18px]">
            Personal Information
          </h3>
          <div className="space-y-0">
            <div className="pb-[14px] mb-[14px] border-b border-slate-100/80 dark:border-surface-variant">
              {isEditingName ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-slate-800 dark:text-on-surface font-normal">
                    Full Name
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-surface-container-high border border-slate-200 dark:border-surface-variant rounded-md px-2 py-1 text-sm text-slate-800 dark:text-on-surface outline-none focus:border-[#0D47A1] dark:focus:border-primary"
                      autoFocus
                    />
                    <button
                      onClick={saveName}
                      className="p-1 text-[#0D47A1] dark:text-primary hover:bg-slate-100 dark:hover:bg-surface-variant rounded-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        check
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={startEditName}
                  className="flex justify-between items-center cursor-pointer hover:opacity-70 active:scale-[0.98] transition-all"
                >
                  <div>
                    <p className="text-[12px] text-slate-800 dark:text-on-surface mb-[2px] font-normal">
                      Full Name
                    </p>
                    <p className="text-[14px] font-normal text-slate-600 dark:text-on-surface-variant">
                      {profile?.displayName || "Ahmet Yılmaz"}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#0D47A1] dark:text-primary text-[18px]">
                    edit
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pb-[14px] mb-[14px] border-b border-slate-100/80 dark:border-surface-variant">
              <div>
                <p className="text-[12px] text-slate-800 dark:text-on-surface mb-[2px] font-normal">
                  Email
                </p>
                <p className="text-[14px] font-normal text-slate-600 dark:text-on-surface-variant">
                  {profile?.email || "ahmet.yilmaz@example.com"}
                </p>
              </div>
              <span
                className="material-symbols-outlined text-slate-300 dark:text-outline text-[18px]"
                title="E-posta adresi değiştirilemez"
              >
                lock
              </span>
            </div>

            <div className="">
              {isEditingPhone ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-slate-800 dark:text-on-surface font-normal">
                    Phone
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editPhoneValue}
                      onChange={(e) => setEditPhoneValue(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-surface-container-high border border-slate-200 dark:border-surface-variant rounded-md px-2 py-1 text-sm text-slate-800 dark:text-on-surface outline-none focus:border-[#0D47A1] dark:focus:border-primary"
                      autoFocus
                    />
                    <button
                      onClick={savePhone}
                      className="p-1 text-[#0D47A1] dark:text-primary hover:bg-slate-100 dark:hover:bg-surface-variant rounded-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        check
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={startEditPhone}
                  className="flex justify-between items-center cursor-pointer hover:opacity-70 active:scale-[0.98] transition-all"
                >
                  <div className="w-full">
                    <p className="text-[12px] text-slate-800 dark:text-on-surface mb-[2px] font-normal">
                      Phone
                    </p>
                    <p className="text-[14px] font-normal text-slate-600 dark:text-on-surface-variant">
                      {profile?.phone || "+90 555 123 4567"}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#0D47A1] dark:text-primary text-[18px]">
                    edit
                  </span>
                </div>
              )}
            </div>

            <div className="w-full h-px bg-slate-100/80 dark:bg-surface-variant my-1"></div>
            <div className="">
              {isEditingCurrency ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-slate-800 dark:text-on-surface font-normal">
                    Primary Currency
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={editCurrencyValue}
                      onChange={(e) => setEditCurrencyValue(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-surface-container-high border border-slate-200 dark:border-surface-variant rounded-md px-2 py-1 text-sm text-slate-800 dark:text-on-surface outline-none focus:border-[#0D47A1] dark:focus:border-primary"
                    >
                      {COMMON_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={saveCurrency}
                      className="p-1 text-[#0D47A1] dark:text-primary hover:bg-slate-100 dark:hover:bg-surface-variant rounded-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        check
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={startEditCurrency}
                  className="flex justify-between items-center cursor-pointer hover:opacity-70 active:scale-[0.98] transition-all"
                >
                  <div className="w-full">
                    <p className="text-[12px] text-slate-800 dark:text-on-surface mb-[2px] font-normal">
                      Primary Currency
                    </p>
                    <p className="text-[14px] font-normal text-slate-600 dark:text-on-surface-variant">
                      {profile?.currency || "TRY"}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#0D47A1] dark:text-primary text-[18px]">
                    edit
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ACTIVE GOAL */}
        <section className="bg-white dark:bg-surface-container rounded-[12px] p-[18px] shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-surface-variant cursor-pointer active:scale-[0.98] transition-transform">
          <h3 className="flex items-center gap-[6px] text-[11px] font-bold text-[#0D47A1] dark:text-primary uppercase tracking-[0.08em] mb-[14px]">
            <span className="material-symbols-outlined text-[16px] -mt-[1px]">
              flag
            </span>
            Active Goal
          </h3>
          <div className="bg-[#f8fafc] dark:bg-surface-container-high rounded-[8px] p-[14px] border border-slate-200/60 dark:border-surface-variant shadow-[inset_0px_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-1">
              <p className="font-[500] text-[15px] text-slate-900 dark:text-on-surface">
                Emergency Fund
              </p>
            </div>
            <div className="flex justify-between items-baseline mb-[14px]">
              <p className="text-[12px] text-slate-600 dark:text-on-surface-variant font-normal">
                ₺15,000 / ₺20,000
              </p>
              <p className="text-[11px] font-semibold text-[#0D47A1] dark:text-primary">
                75%
              </p>
            </div>
            <div className="w-full h-[6px] bg-slate-200/80 dark:bg-surface-variant rounded-full overflow-hidden mb-[10px]">
              <div
                className="h-full bg-[#0D47A1] dark:bg-primary rounded-full"
                style={{ width: "75%" }}
              ></div>
            </div>
            <p className="text-[12px] text-slate-600 dark:text-on-surface-variant font-normal text-center">
              On track to complete by Dec 2024
            </p>
          </div>
        </section>

        {/* PREFERENCES */}
        <section className="bg-white dark:bg-surface-container rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-surface-variant">
          <h3 className="text-[11px] font-bold text-[#0D47A1] dark:text-primary uppercase tracking-[0.08em] mb-[18px]">
            Preferences
          </h3>
          <div className="space-y-[20px]">
            <div
              className="flex justify-between items-center cursor-pointer group"
              onClick={toggleAutoConvert}
            >
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  currency_exchange
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Auto Currency Conversion
                </span>
              </div>
              <button
                className={`w-11 h-6 rounded-full relative transition-colors focus:outline-none ${(profile?.autoConvertCurrency ?? true) ? "bg-[#0D47A1] dark:bg-primary" : "bg-[#1e293b] dark:bg-surface-variant"}`}
              >
                <div
                  className={`w-[18px] h-[18px] rounded-full absolute top-0.5 shadow-sm transition-all ${(profile?.autoConvertCurrency ?? true) ? "bg-white right-1" : "bg-[#cbd5e1] dark:bg-outline left-1"}`}
                ></div>
              </button>
            </div>

            <div
              className="flex justify-between items-center cursor-pointer group"
              onClick={toggleDarkMode}
            >
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  dark_mode
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Dark Mode
                </span>
              </div>
              <button
                className={`w-11 h-6 rounded-full relative transition-colors focus:outline-none ${darkMode ? "bg-[#0D47A1] dark:bg-primary" : "bg-[#1e293b] dark:bg-surface-variant"}`}
              >
                <div
                  className={`w-[18px] h-[18px] rounded-full absolute top-0.5 shadow-sm transition-all ${darkMode ? "bg-white right-1" : "bg-[#cbd5e1] dark:bg-outline left-1"}`}
                ></div>
              </button>
            </div>

            <div
              className="flex justify-between items-center cursor-pointer group"
              onClick={() => setPushNotifs(!pushNotifs)}
            >
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  notifications_active
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Push Notifications
                </span>
              </div>
              <button
                className={`w-11 h-6 rounded-full relative transition-colors focus:outline-none ${pushNotifs ? "bg-[#0D47A1] dark:bg-primary" : "bg-[#1e293b] dark:bg-surface-variant"}`}
              >
                <div
                  className={`w-[18px] h-[18px] rounded-full absolute top-0.5 shadow-sm transition-all ${pushNotifs ? "bg-white right-1" : "bg-[#cbd5e1] dark:bg-outline left-1"}`}
                ></div>
              </button>
            </div>

            <div
              className="flex justify-between items-center cursor-pointer group"
              onClick={() => setBiometric(!biometric)}
            >
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  fingerprint
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Biometric Login
                </span>
              </div>
              <button
                className={`w-11 h-6 rounded-full relative transition-colors focus:outline-none ${biometric ? "bg-[#0D47A1] dark:bg-primary" : "bg-[#1e293b] dark:bg-surface-variant"}`}
              >
                <div
                  className={`w-[18px] h-[18px] rounded-full absolute top-0.5 shadow-sm transition-all ${biometric ? "bg-white right-1" : "bg-[#cbd5e1] dark:bg-outline left-1"}`}
                ></div>
              </button>
            </div>
          </div>
        </section>

        {/* SECURITY */}
        <section className="bg-white dark:bg-surface-container rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-surface-variant">
          <h3 className="text-[11px] font-bold text-[#0D47A1] dark:text-primary uppercase tracking-[0.08em] mb-[16px]">
            Security
          </h3>
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-[10px] hover:opacity-70 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  lock_outline
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Change Password
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                chevron_right
              </span>
            </button>
            <div className="w-full h-px bg-slate-100/80 dark:bg-surface-variant my-1"></div>

            <button className="w-full flex justify-between items-center py-[10px] hover:opacity-70 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  shield
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Data Privacy
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                chevron_right
              </span>
            </button>
            <div className="w-full h-px bg-slate-100/80 dark:bg-surface-variant my-1"></div>

            <button className="w-full flex justify-between items-center py-[10px] hover:opacity-70 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  link
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Linked Accounts
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                chevron_right
              </span>
            </button>
          </div>
        </section>

        {/* SUPPORT */}
        <section className="bg-white dark:bg-surface-container rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-surface-variant mb-6">
          <h3 className="text-[11px] font-bold text-[#0D47A1] dark:text-primary uppercase tracking-[0.08em] mb-[16px]">
            Support
          </h3>
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-[10px] hover:opacity-70 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  help_outline
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Help Center
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                chevron_right
              </span>
            </button>
            <div className="w-full h-px bg-slate-100/80 dark:bg-surface-variant my-1"></div>

            <button className="w-full flex justify-between items-center py-[10px] pb-4 hover:opacity-70 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  description
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Terms of Service
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                chevron_right
              </span>
            </button>

            <button
              onClick={logout}
              className="mt-[6px] w-full flex items-center justify-center gap-2 py-[12px] bg-[#ffe4e4] dark:bg-error-container text-[#A11D1D] dark:text-on-error-container font-semibold text-[15px] rounded-[8px] transition-all hover:bg-red-100 dark:hover:bg-error dark:hover:text-on-error active:scale-[0.98]"
            >
              <span className="material-symbols-outlined font-normal text-[20px]">
                logout
              </span>
              Logout
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
function AddExpenseModal({
  onClose,
  userId,
  profile,
  isCorporateDefault,
  categories,
}: {
  onClose: () => void;
  userId: string;
  profile: UserProfile | null;
  isCorporateDefault: boolean;
  categories: string[];
}) {
  const [step, setStep] = useState<"camera" | "form">("camera");
  const [loading, setLoading] = useState(false);
  const [isCorporate, setIsCorporate] = useState(isCorporateDefault);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<
    "monthly" | "weekly" | "yearly"
  >("monthly");
  const [currency, setCurrency] = useState(profile?.currency || "TRY");

  const [formData, setFormData] = useState({
    amount: "",
    merchant: "",
    category: categories.includes("Other") ? "Other" : categories[0] || "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
  });

  const [flashOn, setFlashOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (step === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const caps = track.getCapabilities() as any;
        if (caps.torch !== undefined) {
          await track.applyConstraints({
            advanced: [{ torch: !flashOn } as any],
          });
          setFlashOn(!flashOn);
        } else {
          // No flash
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setFlashOn(false);
    } catch (err) {
      console.error("Camera access denied", err);
      setStep("form");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64String = canvas.toDataURL("image/jpeg").split(",")[1];
        stopCamera();
        processImage(base64String);
      }
    }
  };

  const processImage = async (base64String: string) => {
    setLoading(true);
    try {
      const extracted = await extractExpenseFromImage(base64String);

      setFormData({
        amount: extracted.amount.toString(),
        merchant: extracted.merchant,
        category: extracted.category,
        date: extracted.date
          ? extracted.date.split("T")[0]
          : format(new Date(), "yyyy-MM-dd"),
        description: extracted.description || "",
      });
      if (
        extracted.currency &&
        COMMON_CURRENCIES.includes(extracted.currency.toUpperCase())
      ) {
        setCurrency(extracted.currency.toUpperCase());
      }
      if (extracted.isCorporatePotential) setIsCorporate(true);
      setStep("form");
    } catch (err) {
      console.error(err);
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(",")[1];
      processImage(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.merchant) return;

    setLoading(true);
    try {
      const parsedAmount = parseFloat(formData.amount);
      let finalAmount = parsedAmount;
      let finalCurrency = currency;
      const primaryCurrency = profile?.currency || "TRY";

      const autoConvert = profile?.autoConvertCurrency ?? true;
      if (autoConvert && currency !== primaryCurrency) {
        finalAmount = await convertCurrency(
          parsedAmount,
          currency,
          primaryCurrency,
          formData.date
        );
        finalCurrency = primaryCurrency;
      }

      const expenseData: any = {
        userId,
        merchant: formData.merchant,
        category: formData.category,
        amount: finalAmount,
        currency: finalCurrency,
        date: formData.date,
        description: formData.description,
        isCorporate,
        createdAt: serverTimestamp(),
      };

      if (currency !== primaryCurrency && finalCurrency === primaryCurrency) {
        expenseData.originalAmount = parsedAmount;
        expenseData.originalCurrency = currency;
      }

      if (isRecurring) {
        expenseData.isRecurring = true;
        expenseData.recurrenceInterval = recurrenceInterval;
        let nextDate = new Date(formData.date);
        if (recurrenceInterval === "monthly") {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (recurrenceInterval === "weekly") {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (recurrenceInterval === "yearly") {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        expenseData.nextRecurrenceDate = nextDate.toISOString().split("T")[0];
      }

      await addDoc(collection(db, "expenses"), expenseData);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "expenses");
    } finally {
      setLoading(false);
    }
  };

  if (step === "camera") {
    return (
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="fixed inset-0 z-[100] bg-black flex flex-col"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Top Controls */}
        <div className="absolute top-0 inset-x-0 p-6 pt-10 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur hover:bg-black/60 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <button
            onClick={() => setStep("form")}
            className="px-4 py-2 rounded-full bg-black/40 text-white font-label-md backdrop-blur hover:bg-black/60 transition-colors"
          >
            Manuel Gir
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 inset-x-0 pb-12 pt-8 px-12 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent">
          <label className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur cursor-pointer hover:bg-white/30 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <span className="material-symbols-outlined text-[24px]">
              photo_library
            </span>
          </label>

          <button
            onClick={captureImage}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative hover:scale-105 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-white/50 backdrop-blur" />
          </button>

          <button
            onClick={toggleFlash}
            className={`w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur hover:bg-white/30 transition-colors ${flashOn ? "text-yellow-400" : ""}`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {flashOn ? "flash_on" : "flash_off"}
            </span>
          </button>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
            <p className="font-label-md text-white">Fiş işleniyor...</p>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-on-background/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-surface w-[100vw] sm:w-[512px] shrink-0 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 border-t sm:border border-surface-variant shadow-[0px_8px_24px_rgba(49,124,184,0.12)] max-h-[90vh] overflow-y-auto relative"
      >
        {loading && (
          <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
            <p className="font-label-md text-primary">İşleniyor...</p>
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            İşlem Ekle
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
                Tutar
              </label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-numeric-lg text-numeric-lg text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-24 bg-surface-container border border-surface-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary appearance-none font-label-md font-bold text-center shadow-sm"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="w-32">
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
                Tür
              </label>
              <button
                type="button"
                onClick={() => setIsCorporate(!isCorporate)}
                className={`w-full h-[54px] rounded-xl flex items-center justify-center gap-2 border transition-all shadow-sm ${isCorporate ? "bg-tertiary-container border-tertiary-container text-on-tertiary-container" : "bg-surface-container border-surface-variant text-on-surface-variant"}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isCorporate ? "business_center" : "person"}
                </span>
                <span className="font-label-md font-bold">
                  {isCorporate ? "İş" : "Kişisel"}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
              Satıcı / İşletme
            </label>
            <input
              required
              placeholder="Mağaza, Hizmet, Restoran..."
              value={formData.merchant}
              onChange={(e) =>
                setFormData({ ...formData, merchant: e.target.value })
              }
              className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
                Kategori
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm appearance-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">
                Tarih
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
              />
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3 border border-surface-variant">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-5 h-5 accent-primary rounded bg-surface-container-lowest border-surface-variant"
              />
              <span className="font-body-md font-medium text-on-surface">
                Düzenli Gider
              </span>
            </label>
            {isRecurring && (
              <div className="pl-8">
                <select
                  value={recurrenceInterval}
                  onChange={(e) =>
                    setRecurrenceInterval(
                      e.target.value as "monthly" | "weekly" | "yearly",
                    )
                  }
                  className="w-full bg-surface-container-lowest rounded-md p-2 border border-surface-variant font-body-sm text-on-surface outline-none focus:border-primary shadow-sm appearance-none"
                >
                  <option value="weekly">Haftalık</option>
                  <option value="monthly">Aylık</option>
                  <option value="yearly">Yıllık</option>
                </select>
              </div>
            )}
          </div>

          <button
            disabled={loading}
            className="w-full py-4 mt-2 bg-primary text-on-primary rounded-xl font-label-md font-bold hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin-slow">
                  sync
                </span>
                İşleniyor...
              </>
            ) : (
              "İşlemi Kaydet"
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
