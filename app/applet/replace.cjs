const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const s1 = code.indexOf('  const [syncingEmails, setSyncingEmails] = useState(false);');
const s2 = code.indexOf('  useEffect(() => {\n    const checkRecurring = async () => {');
const syncStateStr = code.substring(s1, s2);

const h1 = code.indexOf('  const handleSyncEmails = async () => {');
const h2 = code.indexOf('  return (\n    <motion.div \n      initial={{ opacity: 0, scale: 0.98 }}');
const handleSyncStr = code.substring(h1, h2);

const j1 = code.indexOf('      {/* E-Invoice Sync */}');
const j2 = code.indexOf('      {/* Chart Section */}');

let newCode = code.substring(0, s1) + code.substring(s2, h1) + code.substring(h2, j1) + code.substring(j2);


// Now replace InsightsView with SyncView
const view1 = newCode.indexOf('function InsightsView({ expenses, profile }: { expenses: Expense[], profile: UserProfile | null }) {');
const view2 = newCode.indexOf('function EditableCategoryBadge');

newCode = newCode.substring(0, view1) + `
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6 pt-4"
    >
      <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 shadow-sm flex flex-col gap-4">
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
         <div className="mt-2">
           <button 
             onClick={handleSyncEmails}
             disabled={syncingEmails}
             className="px-6 py-2.5 bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white rounded-lg font-label-md transition-colors disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 w-max"
           >
             <span className={"material-symbols-outlined" + (syncingEmails ? " animate-spin" : "")}>sync</span> 
             {syncingEmails ? 'Syncing...' : 'Sync Now'}
           </button>
           <p className="text-sm text-on-surface-variant mt-3">{syncMessage || 'Last sync: Today, 10:45 AM'}</p>
         </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="font-display-sm text-on-surface font-semibold">Imported E-Invoices</h2>
            <p className="font-body-sm text-on-surface-variant">Recently detected receipts from Gmail</p>
          </div>
          <button className="text-[#0D47A1] font-label-md hover:underline bg-transparent border-none cursor-pointer">View All</button>
        </div>

        <div className="space-y-4">
          {pendingExpenses.length === 0 ? (
             <div className="p-8 text-center bg-surface-container-lowest border border-surface-variant rounded-xl text-on-surface-variant text-sm">
               No pending imported e-invoices found.
             </div>
          ) : (
             pendingExpenses.map(e => (
               <div key={e.id} className="bg-surface-container-lowest border border-surface-variant rounded-xl p-5 shadow-sm">
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
                     className="py-2.5 rounded-lg border border-surface-variant text-on-surface hover:bg-surface-container transition-colors font-label-md"
                   >
                     Review
                   </button>
                   <button 
                     onClick={() => handleConfirm(e)}
                     className="py-2.5 rounded-lg bg-[#4A6273] hover:bg-[#344654] text-white transition-colors font-label-md"
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

` + newCode.substring(view2);

newCode = newCode.replace(/expenses\.some/g, 'allExpenses.some');
fs.writeFileSync('src/App.tsx', newCode);
console.log('Done replacement');
