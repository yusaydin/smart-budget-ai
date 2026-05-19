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
} from "../lib/firebase";
import {
  extractExpenseFromEmail,
  extractExpenseFromImage,
  getCorporateAdvice,
  generateMonthlyReport
} from "../../ai/gemini";
import Markdown from "react-markdown";
import { fetchRecentReceiptEmails } from "../../backend/gmail";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { Sparkles, Mail, Lock, Receipt } from "lucide-react";
import { convertCurrency, formatCurrency } from "../lib/utils";
import { Expense, UserProfile } from "../types";
import { DEFAULT_CATEGORIES, COMMON_CURRENCIES } from "../constants";
import { ExpenseItem } from "./ExpenseItem";


export function Dashboard({
  profile,
  expenses,
  setActiveTab,
}: {
  profile: UserProfile | null;
  expenses: Expense[];
  setActiveTab: (tab: any) => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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

  const handleGenerateReport = async () => {
    setIsReportModalOpen(true);
    setReportLoading(true);
    setReportContent(null);
    try {
      if (!profile) throw new Error("Profile naturally missing");
      const report = await generateMonthlyReport(
        currentMonthExpenses,
        profile.monthlyIncome || 0,
        profile.isCorporate || false
      );
      setReportContent(report);
    } catch (e) {
      console.error(e);
      setReportContent("Rapor oluşturulurken bir hata oluştu. Daha sonra tekrar deneyin.");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      className="space-y-8"
    >
      {/* Total Balance & Monthly Budget Section */}
      <div className="px-4 sm:px-6 pt-4 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
              TOPLAM BAKİYE
            </p>
            <div className="flex items-center gap-3">
              <h2 className="text-[32px] leading-none font-bold text-on-surface tracking-tight">
                {formatCurrency(
                  profile?.monthlyIncome || 0,
                  profile?.currency || "TRY",
                )}
              </h2>
              <div className="flex items-center bg-surface-container-high/60 backdrop-blur-sm border border-outline-variant/30 rounded-full px-2 py-1">
                <button
                  onClick={() => setMonthOffset((prev) => prev - 1)}
                  disabled={monthOffset === -11}
                  className={`w-5 h-5 flex items-center justify-center transition-colors ${monthOffset === -11 ? "text-on-surface/30 cursor-not-allowed" : "text-on-surface hover:text-primary"}`}
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                </button>
                <span className="text-[10px] px-1 font-medium text-on-surface capitalize">
                  {format(targetMonthDate, "MMM yyyy", { locale: tr })}
                </span>
                <button
                  onClick={() => setMonthOffset((prev) => prev + 1)}
                  disabled={monthOffset === 0}
                  className={`w-5 h-5 flex items-center justify-center transition-colors ${monthOffset === 0 ? "text-on-surface/30 cursor-not-allowed" : "text-on-surface hover:text-primary"}`}
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 sm:mx-6 mb-4 bg-surface-container-low rounded-xl p-5 shadow-sm border border-surface-variant relative overflow-hidden">
        <div className="absolute right-[-10%] top-[-10%] opacity-5">
          <span className="material-symbols-outlined text-[100px]">account_balance</span>
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[15px] font-bold text-on-surface">Aylık Bütçe</h3>
            <span className="text-[11px] font-medium text-outline">
              %{profile?.monthlyIncome ? Math.min(((totalSpent / profile.monthlyIncome) * 100), 100).toFixed(0) : 0} Harcandı
            </span>
          </div>

          <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden mb-3 border border-outline-variant/20">
            <div
              className={`${Math.min(profile?.monthlyIncome ? (totalSpent / profile.monthlyIncome) * 100 : 0, 100) > 90 ? 'bg-error' : 'bg-primary'} h-full rounded-full transition-all duration-1000`}
              style={{
                width: `${Math.min(profile?.monthlyIncome ? (totalSpent / profile.monthlyIncome) * 100 : 0, 100)}%`,
              }}
            ></div>
          </div>

          <div className="flex justify-between items-center text-[11px] font-medium">
            <span className="text-on-surface-variant">
              {formatCurrency(totalSpent, profile?.currency || "TRY")} harcandı
            </span>
            <span className="text-on-surface-variant">
              {formatCurrency(remaining, profile?.currency || "TRY")} kaldı
            </span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0px_4px_12px_rgba(13,71,161,0.05)] border border-surface-variant overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-on-surface">
              Harcama Analizi
            </h3>
            <p className="text-xs text-outline capitalize">
              {format(targetMonthDate, "MMMM yyyy", { locale: tr })} Özeti
            </p>
          </div>
          <div className="flex gap-2">
            <div className="px-2.5 py-1 bg-surface-container rounded-full text-xs font-medium text-on-surface-variant">
              Tümü
            </div>
          </div>
        </div>
        <div className="h-40 mb-4 flex items-center justify-center px-2">
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
                  className="bg-surface-container rounded-lg p-3 border border-surface-variant flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    <span className="text-[10px] font-medium text-on-surface-variant block mb-1 uppercase tracking-wider">
                      Kategori {i + 1}
                    </span>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className="text-sm font-medium text-on-surface truncate mr-2 flex-1"
                        title={cat}
                      >
                        {cat}
                      </span>
                      <span className="text-xs font-semibold text-primary whitespace-nowrap">
                        {formatCurrency(val, profile?.currency || "TRY")}{" "}
                        {budget
                          ? `/ ${formatCurrency(budget, profile?.currency || "TRY")}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  {budget ? (
                    <div className="w-full bg-surface-container-high rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full ${pct > 90 ? "bg-error" : pct > 75 ? "bg-tertiary" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      </div>

      {/* AI AI Insights Summary */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 shadow-[0px_4px_12px_rgba(13,71,161,0.05)] mx-4 sm:mx-6 mb-4">
        <h3 className="text-primary text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">
            auto_awesome
          </span>
          YZ Harcama Analizi
        </h3>
        <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
          Yapay zeka asistanınız, harcama alışkanlıklarınızı analiz ederek size özel tasarruf ve bütçe yönetimi tavsiyeleri sunar.
        </p>
        <button
          onClick={handleGenerateReport}
          className="w-full py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-xs font-medium transition-colors active:scale-95 shadow-sm"
        >
          Aylık Harcama Raporu Üret
        </button>
      </div>

      {/* Corporate Summary */}
      {profile?.isCorporate && (
        <div className="bg-tertiary-container/10 border border-tertiary/20 rounded-xl p-5 shadow-[0px_4px_12px_rgba(13,71,161,0.05)]">
          <h3 className="text-tertiary text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">
              business_center
            </span>{" "}
            YZ Vergi Analizi
          </h3>
          <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
            Bu ay {corporateExpenses.length} adet kurumsal işleminiz var.
            Potansiyel vergi indirimi:{" "}
            <span className="text-sm font-bold text-on-surface">
              {formatCurrency(
                corporateExpenses.reduce((s, e) => s + e.amount, 0),
                profile?.currency || "TRY",
              )}
            </span>
          </p>
          <button
            onClick={() => setActiveTab("insights")}
            className="w-full py-2 bg-surface-container-lowest border border-surface-variant hover:bg-surface-container-low text-on-surface rounded-lg text-xs font-medium transition-colors active:scale-95 shadow-sm"
          >
            Vergi Öngörülerini Gör
          </button>
        </div>
      )}

      {/* Recent List */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1">
        <h3 className="text-[11px] font-bold text-outline-variant uppercase tracking-wider mb-3">
          İşlemler
        </h3>
        <div className="space-y-0.5">
          {currentMonthExpenses.length > 0 ? (
            currentMonthExpenses
              .slice(0, 5)
              .map((exp) => <ExpenseItem key={exp.id} expense={exp} />)
          ) : (
            <p className="text-sm text-outline">Bu ay hiç işlem yok.</p>
          )}
        </div>
      </div>

      {/* AI Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex animate-in fade-in transition-all duration-300"
          >
            <div className="absolute inset-0 bg-black/60 shadow-lg backdrop-blur-sm" onClick={() => setIsReportModalOpen(false)}></div>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 w-full bg-surface max-h-[90vh] rounded-t-[2.5rem] flex flex-col shadow-2xl border-t border-surface-variant overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-surface-variant sticky top-0 bg-surface/80 backdrop-blur-xl z-20">
                <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  Harcama Analizi
                </h3>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-surface-container-highest hover:bg-surface-variant flex items-center justify-center text-on-surface transition-colors focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <span className="material-symbols-outlined animate-spin text-[40px] text-primary">sync</span>
                    <p className="text-sm font-medium text-on-surface-variant">Yapay zeka verilerinizi analiz ediyor...</p>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <Markdown>{reportContent || ""}</Markdown>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}