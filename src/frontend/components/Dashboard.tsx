import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Pie } from "react-chartjs-2";
import { formatCurrency } from "../lib/utils";
import { Expense, UserProfile } from "../types";
import { ExpenseItem } from './ExpenseItem';



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
      className="space-y-8"
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