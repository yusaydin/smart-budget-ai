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
  getCorporateAdvice
} from "../../ai/gemini";
import { fetchRecentReceiptEmails } from "../../backend/gmail";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { Sparkles, Mail, Lock, Receipt } from "lucide-react";
import { convertCurrency, formatCurrency } from "../lib/utils";
import { Expense, UserProfile } from "../types";
import { DEFAULT_CATEGORIES, COMMON_CURRENCIES } from "../constants";


export function ExpenseItem({ expense, detail = false }: { expense: Expense, detail?: boolean }) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const showAdvice = async () => {
    if (!expense.isCorporate) return;
    setLoadingAdvice(true);
    try {
      const resp = await getCorporateAdvice(expense);
      setAdvice(resp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-2 border-b border-surface-variant hover:bg-surface-bright transition-colors cursor-pointer group last:border-0 relative">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform shrink-0 ${expense.isCorporate ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'}`}>
           {expense.merchant.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h4 className="text-sm text-on-surface font-medium truncate max-w-[140px] sm:max-w-xs flex items-center gap-1">
            {expense.merchant}
            {expense.isRecurring && <span className="material-symbols-outlined text-[12px] text-primary">event_repeat</span>}
          </h4>
          <p className="text-[11px] text-outline flex items-center gap-1 mt-0.5">
            <span className="whitespace-nowrap">{format(new Date(expense.date), 'MMM d', { locale: tr })}</span>
            <span>•</span>
            <span className="truncate">{expense.category}</span>
          </p>
        </div>
      </div>
      <div className="text-right flex flex-col items-end gap-0.5 shrink-0 ml-2">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-base font-semibold text-error whitespace-nowrap">-{formatCurrency(expense.amount, expense.currency)}</span>
          {expense.originalAmount && expense.originalCurrency && expense.originalCurrency !== expense.currency && (
            <span className="text-[10px] text-outline font-medium whitespace-nowrap">({formatCurrency(expense.originalAmount, expense.originalCurrency)})</span>
          )}
        </div>
        <div className="flex gap-1 mt-0.5">
          {expense.isCorporate && <div className="px-1.5 py-px rounded bg-tertiary-container/10 text-[9px] font-bold text-tertiary uppercase">Kurumsal</div>}
          {expense.isRecurring && <div className="px-1.5 py-px rounded bg-primary-container/10 text-[9px] font-bold text-primary uppercase">{expense.recurrenceInterval === 'yearly' ? 'Yıl' : expense.recurrenceInterval === 'weekly' ? 'Hafta' : 'Ay'}</div>}
        </div>
      </div>
      
      {detail && expense.isCorporate && (
        <div className="w-full left-0 mt-4 pt-4 border-t border-surface-variant flex-col items-start hidden">
          {/* Note: expanding logic can be implemented, hidden for default state */}
          {advice ? (
            <div className="text-[11px] text-violet-200/70 leading-relaxed bg-violet-500/10 p-3 rounded-lg border border-violet-500/20">
              <div className="flex items-center gap-1.5 mb-1 text-violet-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Yapay Zeka Vergi Önerisi</span>
              </div>
              {advice}
            </div>
          ) : (
            <button 
              onClick={showAdvice}
              disabled={loadingAdvice}
              className="text-[10px] text-slate-500 flex items-center gap-1 hover:text-violet-400 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {loadingAdvice ? 'Analiz Ediliyor...' : 'YZ Vergi Önerisi Al'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}