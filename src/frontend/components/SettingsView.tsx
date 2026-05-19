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


export function SettingsView({ profile }: { profile: UserProfile | null }) {
  const [pushNotifs, setPushNotifs] = useState(true);
  const [biometric, setBiometric] = useState(true);

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editPhoneValue, setEditPhoneValue] = useState("");

  const [isEditingCurrency, setIsEditingCurrency] = useState(false);
  const [editCurrencyValue, setEditCurrencyValue] = useState("");

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    if (auth.currentUser && theme !== profile?.theme) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        theme
      });
    }
  };

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
        {/* PROFILE/PERSONAL INFO */}
        <section className="bg-white dark:bg-surface-container rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-surface-variant">
          <h3 className="text-[11px] font-bold text-[#0D47A1] dark:text-primary uppercase tracking-[0.08em] mb-[18px]">
            Kişisel Bilgiler
          </h3>
          <div className="space-y-0">
            <div className="pb-[14px] mb-[14px] border-b border-slate-100/80 dark:border-surface-variant">
              {isEditingName ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-slate-800 dark:text-on-surface font-normal">
                    Ad Soyad
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
                      Ad Soyad
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
                  E-posta
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
                    Telefon
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
                      Telefon
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
                    Para Birimi
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
                      Para Birimi
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
            Aktif Hedef
          </h3>
          <div className="bg-[#f8fafc] dark:bg-surface-container-high rounded-[8px] p-[14px] border border-slate-200/60 dark:border-surface-variant shadow-[inset_0px_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-1">
              <p className="font-[500] text-[15px] text-slate-900 dark:text-on-surface">
                Acil Durum Fonu
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
              Aralık 2024'te tamamlanması hedefleniyor
            </p>
          </div>
        </section>

        {/* PREFERENCES */}
        <section className="bg-white dark:bg-surface-container rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-surface-variant">
          <h3 className="text-[11px] font-bold text-[#0D47A1] dark:text-primary uppercase tracking-[0.08em] mb-[18px]">
            Tercihler
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
                  Otomatik Kur Çevirimi
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

            <div className="flex flex-col gap-3 py-2 border-b border-slate-100/80 dark:border-surface-variant">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  palette
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Tema
                </span>
              </div>
              <div className="flex bg-slate-100 dark:bg-surface-container rounded-lg p-1">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      (profile?.theme || 'system') === t
                        ? "bg-white dark:bg-surface-variant text-[#0D47A1] dark:text-primary shadow-sm"
                        : "text-slate-600 dark:text-on-surface-variant hover:text-slate-900 dark:hover:text-on-surface"
                    }`}
                  >
                    {t === 'light' ? 'Açık' : t === 'dark' ? 'Koyu' : 'Sistem'}
                  </button>
                ))}
              </div>
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
                  Anlık Bildirimler
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
                  Biyometrik Giriş
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
            Güvenlik
          </h3>
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-[10px] hover:opacity-70 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  lock_outline
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Şifre Değiştir
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
                  Veri Gizliliği
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
                  Bağlı Hesaplar
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
            Destek
          </h3>
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-[10px] hover:opacity-70 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  help_outline
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Yardım Merkezi
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
                  Kullanım Koşulları
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
              Çıkış Yap
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}