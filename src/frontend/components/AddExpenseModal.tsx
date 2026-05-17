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
import { ExpenseItem } from './ExpenseItem';


export function AddExpenseModal({
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