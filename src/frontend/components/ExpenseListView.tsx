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
import { ExpenseItem } from "./ExpenseItem";


export function ExpenseListView({
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
      <div className="flex flex-col gap-3">
        {/* Search Bar - Simulated conceptually matching the design */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            className="w-full bg-surface-container-lowest border border-surface-variant rounded-lg py-2.5 pl-10 pr-3 text-sm text-on-surface focus:outline-none focus:border-primary shadow-sm transition-all"
            placeholder="Search transactions..."
            type="text"
            // Note: implementing search functionality is a bonus, leaving as placeholder for styling purposes
          />
        </div>

        {/* Filters array like the design */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterType("All")}
            className={`flex items-center gap-1.5 border border-surface-variant rounded-full px-3 py-1.5 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === "All" ? "bg-primary-fixed text-on-primary-fixed border-transparent" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              filter_list
            </span>
            <span className="text-xs font-medium">Tümü</span>
          </button>
          <button
            onClick={() => setFilterType("Personal")}
            className={`flex items-center gap-1.5 border border-surface-variant rounded-full px-3 py-1.5 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === "Personal" ? "bg-primary-fixed text-on-primary-fixed border-transparent" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              person
            </span>
            <span className="text-xs font-medium">Kişisel</span>
          </button>
          <button
            onClick={() => setFilterType("Corporate")}
            className={`flex items-center gap-1.5 border border-surface-variant rounded-full px-3 py-1.5 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === "Corporate" ? "bg-primary-fixed text-on-primary-fixed border-transparent" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              business
            </span>
            <span className="text-xs font-medium">İş</span>
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
            <p className="text-sm text-on-surface-variant">
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