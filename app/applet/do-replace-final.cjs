const fs = require('fs');
let code = fs.readFileSync('src/App_backup.tsx', 'utf8');

const s1 = code.indexOf('  const [syncingEmails, setSyncingEmails] = useState(false);');
const s2 = code.indexOf('  useEffect(() => {\n    const checkRecurring = async () => {');
const syncStateStr = code.substring(s1, s2);

const h1 = code.indexOf('  const handleSyncEmails = async () => {');
const h2 = code.indexOf('  return (\n    <motion.div \n      initial={{ opacity: 0, scale: 0.98 }}');
const handleSyncStr = code.substring(h1, h2);

let currentCode = fs.readFileSync('src/App.tsx', 'utf8');

// Now replace InsightsView with SyncView
const view1 = currentCode.indexOf('function InsightsView({ expenses, profile }: { expenses: Expense[], profile: UserProfile | null }) {');
const view2 = currentCode.indexOf('function EditableCategoryBadge');

let newCode = currentCode.substring(0, view1) + `
function SyncView({ profile, pendingExpenses, allExpenses }: { profile: UserProfile | null, pendingExpenses: Expense[], allExpenses: Expense[] }) {
` + syncStateStr + handleSyncStr + `
  const handleConfirm = async (e: Expense) => {
     try {
       await updateDoc(doc(db, 'expenses', e.id), { syncStatus: 'confirmed' });
     } catch(err) {
       handleFirestoreError(err, OperationType.UPDATE, 'expenses');
     }
  };

  const handleReview = (e: Expense) => {
      handleConfirm(e);
  };

  const deletePendingEmails = async () => {
    if (!profile) return;
    if (confirm('Sadece E-posta\\'dan okunan tüm harcamalar silinecek. Onaylıyor musunuz?')) {
      try {
        const emailExpenses = allExpenses.filter(e => e.emailId);
        if (emailExpenses.length === 0) {
           alert('Silinecek e-posta harcaması bulunamadı.');
           return;
        }

        const batch = writeBatch(db);
        for (const exp of emailExpenses) {
           batch.delete(doc(db, 'expenses', exp.id));
        }

        const userRef = doc(db, 'users', profile.uid);
        batch.update(userRef, { processedEmailIds: [] });

        await batch.commit();
        alert('E-posta harcamaları kaldırıldı ve e-posta okuma geçmişi sıfırlandı.');
      } catch (e: any) {
        alert('Hata: ' + e.message);
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
             <span className="material-symbols-outlined text-secondary">mail</span>
           </div>
           <div className="flex-grow">
             <h3 className="font-label-lg font-bold text-on-surface">Connected Account</h3>
             <p className="font-body-md text-on-surface-variant">{profile?.email || 'user@gmail.com'}</p>
             <div className="flex items-center gap-2 mt-2">
                <span className="text-secondary text-sm cursor-pointer hover:underline">Değiştir</span>
                <span className="text-on-surface-variant text-sm flex items-center before:content-[''] before:w-2 before:h-2 before:bg-tertiary-fixed before:rounded-full before:mr-2">Active connection</span>
             </div>
           </div>
         </div>
         <div className="mt-4 flex flex-wrap gap-4">
           <button 
             onClick={handleSyncEmails}
             disabled={syncingEmails}
             className="px-6 py-2.5 bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white rounded-lg font-label-md transition-colors disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 w-max"
           >
             <span className={"material-symbols-outlined" + (syncingEmails ? " animate-spin" : "")}>sync</span> 
             {syncingEmails ? 'Syncing...' : 'Sync Now'}
           </button>
           <button 
             onClick={deletePendingEmails}
             className="px-6 py-2.5 bg-error/10 hover:bg-error/20 text-error rounded-lg font-label-md transition-colors active:scale-95 flex items-center justify-center gap-2 w-max"
           >
             <span className="material-symbols-outlined">delete</span> 
             Reset History
           </button>
         </div>
         <p className="text-sm text-on-surface-variant mt-2">{syncMessage || 'Last sync: Today, 10:45 AM'}</p>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4 px-1">
          <div>
            <h2 className="font-display-sm text-on-surface font-semibold">Imported E-Invoices</h2>
            <p className="font-body-sm text-on-surface-variant">Recently detected receipts from Gmail</p>
          </div>
          <button className="text-[#0D47A1] font-label-md hover:underline bg-transparent border-none cursor-pointer">View All</button>
        </div>

        <div className="space-y-4">
          {pendingExpenses.length === 0 ? (
             <div className="p-8 text-center bg-surface border border-surface-variant rounded-xl text-on-surface-variant text-sm">
               No pending imported e-invoices found.
             </div>
          ) : (
             pendingExpenses.map(e => (
               <div key={e.id} className="bg-surface border border-surface-variant rounded-xl p-5 shadow-sm">
                 <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-full border border-surface-variant flex items-center justify-center shrink-0">
                       <span className="material-symbols-outlined text-on-surface-variant">
                         {e.category === 'Ulaşım' ? 'directions_car' : e.category === 'Yemek' ? 'restaurant' : e.category === 'Alışveriş' ? 'storefront' : 'receipt_long'}
                       </span>
                     </div>
                     <div>
                       <h4 className="font-label-lg font-bold text-on-surface">{e.merchant}</h4>
                       <p className="font-body-sm text-on-surface-variant">{format(new Date(e.date), 'MMM d, yyyy')}</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <span className="font-display-md font-bold text-on-surface">{e.currency === 'USD' ? '$' : e.currency === 'TRY' ? '₺' : ''}{e.amount.toFixed(2)}</span>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                   <button 
                     onClick={() => handleReview(e)}
                     className="py-2.5 rounded-lg border border-surface-variant text-on-surface hover:bg-surface-container transition-colors font-label-md cursor-pointer"
                   >
                     Review
                   </button>
                   <button 
                     onClick={() => handleConfirm(e)}
                     className="py-2.5 rounded-lg bg-[#4A6273] hover:bg-[#344654] text-white transition-colors font-label-md cursor-pointer shadow-sm"
                   >
                     Confirm
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

` + currentCode.substring(view2);

newCode = newCode.replace(/expenses\.some/g, 'allExpenses.some');
// and replace expenses mapping if they reference the original "expenses" hook implicitly
// wait, inside handleSyncEmails: expenses.length ... wait, Dashboard had "expenses" prop!
// the old function InsightsView didn't have handleSyncEmails so it's fine.
fs.writeFileSync('src/App.tsx', newCode);
console.log('Success!!');
