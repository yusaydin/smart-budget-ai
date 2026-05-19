import { motion } from "framer-motion";
import {
  doc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
} from "../lib/firebase";
import { format } from "date-fns";
import { formatCurrency } from "../lib/utils";
import { Expense, UserProfile } from "../types";



export function SyncView({
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