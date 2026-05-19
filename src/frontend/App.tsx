import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  logout,
  signInWithGoogle
} from "./lib/firebase";
import {
  extractExpenseFromEmail,
  extractExpenseFromImage,
  getCorporateAdvice
} from "../ai/gemini";
import { fetchRecentReceiptEmails } from "../backend/gmail";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { Sparkles, Mail, Lock, Receipt } from "lucide-react";

import { convertCurrency, formatCurrency } from "./lib/utils";
import { Expense, UserProfile } from "./types";
import { DEFAULT_CATEGORIES, COMMON_CURRENCIES } from "./constants";
import { NavButton } from "./components/NavButton";
import { Dashboard } from "./components/Dashboard";
import { ExpenseListView } from "./components/ExpenseListView";
import { SyncView } from "./components/SyncView";
import { SettingsView } from "./components/SettingsView";
import { AddExpenseModal } from "./components/AddExpenseModal";
import { ExpenseItem } from "./components/ExpenseItem";
import { AuthScreen } from "./components/AuthScreen";
import { LoadingScreen } from "./components/LoadingScreen";






ChartJS.register(ArcElement, Tooltip, Legend);








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
              theme: "system",
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

  useEffect(() => {
    const applyTheme = (theme: 'light' | 'dark' | 'system' | undefined) => {
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (theme === 'dark' || (theme === 'system' && isSystemDark)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(profile?.theme || 'system');

    // Listener for system theme change
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (!profile?.theme || profile.theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [profile?.theme]);

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  const activeExpenses = expenses.filter((e) => e.syncStatus !== "pending");
  const pendingExpenses = expenses.filter((e) => e.syncStatus === "pending");

  return (
    <div className="min-h-screen flex flex-col antialiased overflow-x-hidden">
      {/* TopAppBar */}
      <header className="bg-surface text-primary shadow-sm flex justify-between items-center px-4 sm:px-6 h-14 w-full z-50 sticky top-0 shadow-[0px_4px_12px_rgba(13,71,161,0.05)]">
        <button className="text-primary hover:bg-surface-container-high transition-colors active:scale-95 duration-200 p-2 rounded-full flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">
            account_balance_wallet
          </span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center">
          BudgetAI
        </h1>
        <button onClick={logout} title="Çıkış Yap" className="text-error hover:bg-error/10 transition-colors active:scale-95 duration-200 p-2 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
          <span className="material-symbols-outlined text-[20px]">logout</span>
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
      <nav className="bg-surface-container-lowest text-primary shadow-[0px_-4px_12px_rgba(13,71,161,0.05)] fixed bottom-0 left-0 right-0 w-full z-40 flex justify-evenly items-center px-2 py-2 pb-6 rounded-t-2xl sm:hidden">
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

// --- Moved Sub-Components ---

// --- Components ---
