import React, { useState, useEffect, useRef } from 'react';
import { 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { auth, db, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { extractExpenseFromImage, generateMonthlyReport, extractExpenseFromEmail } from './services/gemini';
import { fetchRecentReceiptEmails } from './services/gmail';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import Markdown from 'react-markdown';

import { COMMON_CURRENCIES, DEFAULT_CATEGORIES } from './constants';
import { formatCurrency } from './lib/utils';
import { Expense, UserProfile } from './types';

import { ExpenseItem } from './components/ExpenseItem';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthScreen } from './components/AuthScreen';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'insights' | 'settings'>('dashboard');
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
        const docRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'User',
              isCorporate: false,
              monthlyIncome: 0,
              currency: 'TRY',
              categories: DEFAULT_CATEGORIES,
              syncLabels: '',
              syncFrequency: '6months'
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (e) {
          console.error("Profile fetch/create failed:", e);
        }

        // Fetch Expenses
        const q = query(
          collection(db, 'expenses'),
          where('userId', '==', u.uid),
          orderBy('date', 'desc')
        );

        unsubExpenses = onSnapshot(q, (snapshot) => {
          setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

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

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  const toggleCorporate = async () => {
    if (!profile) return;
    const newStatus = !profile.isCorporate;
    await setDoc(doc(db, 'users', user.uid), { ...profile, isCorporate: newStatus });
    setProfile({ ...profile, isCorporate: newStatus });
  };

  const activeExpenses = expenses.filter(e => e.syncStatus !== 'pending');
  const pendingExpenses = expenses.filter(e => e.syncStatus === 'pending');

  return (
    <div className="min-h-screen flex flex-col antialiased">
      {/* TopAppBar */}
      <header className="bg-surface text-primary shadow-sm flex justify-between items-center px-margin-mobile h-16 w-full z-50 sticky top-0 shadow-[0px_4px_12px_rgba(13,71,161,0.05)]">
        <button className="text-primary hover:bg-surface-container-high transition-colors active:scale-95 duration-200 p-2 rounded-full flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined">account_balance_wallet</span>
        </button>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tight text-center">Lira</h1>
        <button 
          onClick={logout}
          className="text-primary hover:bg-surface-container-high transition-colors active:scale-95 duration-200 p-2 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
        >
          {user?.photoURL ? <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full object-cover" /> : <span className="material-symbols-outlined">exit_to_app</span>}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-margin-mobile py-6 pb-32 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard profile={profile} expenses={activeExpenses} setActiveTab={setActiveTab} key="dashboard" />}
          {activeTab === 'expenses' && <ExpenseListView expenses={activeExpenses} profile={profile} key="expenses" />}
          {activeTab === 'insights' && <SyncView profile={profile} pendingExpenses={pendingExpenses} allExpenses={expenses} key="sync" />}
          {activeTab === 'settings' && <SettingsView profile={profile} key="settings" toggleCorporate={toggleCorporate} />}
        </AnimatePresence>
      </main>

      {/* BottomNavBar */}
      <nav className="bg-surface-container-lowest text-primary shadow-[0px_-4px_12px_rgba(13,71,161,0.05)] fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-4 py-3 pb-6 rounded-t-xl sm:hidden">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="home" label="Ana Sayfa" />
        <NavButton active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon="receipt_long" label="Liste" />
        <NavButton active={false} onClick={() => setIsAddModalOpen(true)} icon="add_a_photo" label="Tara" />
        <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon="sync" label="YZ / Senkronize" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="person" label="Ayarlar" />
      </nav>

      {/* Desktop sidebar-like floating nav (optional fallback) */}
      <nav className="hidden sm:flex fixed bottom-8 left-1/2 -translate-x-1/2 h-16 bg-surface-container-lowest rounded-[2rem] border border-surface-variant px-6 items-center gap-4 z-40 shadow-[0px_4px_12px_rgba(13,71,161,0.05)]">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="home" label="Ana Sayfa" />
        <NavButton active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon="receipt_long" label="Liste" />
        <NavButton active={false} onClick={() => setIsAddModalOpen(true)} icon="add_a_photo" label="Tara" />
        <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon="sync" label="YZ / Senkronize" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="person" label="Ayarlar" />
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

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: string, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center px-4 py-1 hover:bg-surface-container-low transition-all active:scale-90 duration-200 ${active ? 'text-primary bg-secondary-container/20 rounded-xl' : 'text-on-surface-variant'}`}>
      <span className={`material-symbols-outlined text-[24px] ${active ? 'filled' : ''}`}>
        {icon}
      </span>
      <span className="font-label-md text-label-md mt-1">
        {label}
      </span>
    </button>
  );
}

function Dashboard({ profile, expenses, setActiveTab }: { profile: UserProfile | null, expenses: Expense[], setActiveTab: (tab: any) => void }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const targetMonthDate = new Date();
  targetMonthDate.setMonth(targetMonthDate.getMonth() + monthOffset);

  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === targetMonthDate.getMonth() && d.getFullYear() === targetMonthDate.getFullYear();
  });

  const totalSpent = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = (profile?.monthlyIncome || 0) - totalSpent;
  const corporateExpenses = currentMonthExpenses.filter(e => e.isCorporate);
  
  const categoryData = currentMonthExpenses.reduce((acc: any, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  const [syncingEmails, setSyncingEmails] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    const checkRecurring = async () => {
      if (!profile || expenses.length === 0) return;
      const today = new Date().toISOString().split('T')[0];
      const recurring = expenses.filter(e => e.isRecurring && e.nextRecurrenceDate && e.nextRecurrenceDate <= today);

      for (const rec of recurring) {
        if (!rec.nextRecurrenceDate) continue;
        try {
          // Generate new occurrence
          await addDoc(collection(db, 'expenses'), {
            userId: profile.uid,
            amount: rec.amount,
            currency: rec.currency || 'TRY',
            merchant: rec.merchant,
            category: rec.category,
            date: rec.nextRecurrenceDate,
            description: rec.description || `Düzenli İşlem (${rec.merchant})`,
            isCorporate: rec.isCorporate,
            createdAt: serverTimestamp(),
            parentId: rec.id
          });

          // Update the parent
          let nextDate = new Date(rec.nextRecurrenceDate);
          if (rec.recurrenceInterval === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
          } else if (rec.recurrenceInterval === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (rec.recurrenceInterval === 'yearly') {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
          } else {
            nextDate.setMonth(nextDate.getMonth() + 1); // default fallback
          }
          
          await updateDoc(doc(db, 'expenses', rec.id), {
            nextRecurrenceDate: nextDate.toISOString().split('T')[0]
          });
        } catch (e) {
          console.error("Failed to process recurrence: ", e);
        }
      }
    };
    checkRecurring();
  }, [profile, expenses]);

  const handleSyncEmails = async () => {
    setSyncingEmails(true);
    setSyncMessage('Gmail\'e bağlanılıyor...');
    try {
      const emails = await fetchRecentReceiptEmails({
          frequency: profile?.syncFrequency || '6months',
          folder: profile?.syncLabels || ''
      }, () => {
          setSyncMessage('Gmail ile bağlandı. Faturalar aranıyor...');
      });
      if (emails.length === 0) {
        setSyncMessage('Yeni fatura bulunamadı.');
        setTimeout(() => setSyncMessage(''), 3000);
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
        
        const keywords = ['receipt', 'invoice', 'fatura', 'order', 'sipariş', 'payment', 'ödeme', 'makbuz', 'purchase', 'ticket', 'bilet'];
        // Quick short-circuit if subject matches
        if (keywords.some(k => lowerSubject.includes(k))) return true;
        // Or if the first chunk of text mentions it
        if (keywords.some(k => lowerText.substring(0, 800).includes(k))) return true;
        
        return false;
      };

      for (const email of emails) {
        if (processedIds.has(email.id)) {
           skipped++;
           continue; // Already processed
        }

        if (!isLikelyReceipt(email.subject || '', email.text || '') && (email.pdfAttachments?.length || 0) === 0) {
           skipped++;
           // We will mark it as processed so we don't evaluate it again
           newProcessedIds.push(email.id);
           processedIds.add(email.id);
           if (profile) {
             const updatedProcessedIds = [...(profile.processedEmailIds || []), email.id].slice(-1000);
             await setDoc(doc(db, 'users', profile.uid), { ...profile, processedEmailIds: updatedProcessedIds });
             profile.processedEmailIds = updatedProcessedIds;
           }
           continue; // Skip emails that clearly don't look like a receipt
        }
        
        try {
          const truncatedText = (email.text || '').substring(0, 15000);
          const extractedResults = await extractExpenseFromEmail(`Subject: ${email.subject || 'No Subject'}\n\n${truncatedText}`, email.pdfAttachments || [], cats);
          
          const seen = new Set();
          for (const extracted of extractedResults) {
            if (extracted && extracted.amount > 0) {
              const key = `${extracted.amount}-${extracted.merchant}-${extracted.date}`;
              if (seen.has(key)) continue;
              
              // Check if already in the DB to prevent duplicates
              const isDuplicate = expenses.some(e => e.amount === (typeof extracted.amount === 'string' ? parseFloat(extracted.amount) : extracted.amount) && e.date === extracted.date && e.merchant.toLowerCase() === (extracted.merchant || '').toLowerCase());
              if (isDuplicate) {
                  skipped++;
                  continue;
              }
              
              seen.add(key);

              const extractedCurrency = extracted.currency || profile?.currency || 'TRY';
              const extractedAmount = typeof extracted.amount === 'string' ? parseFloat(extracted.amount) : extracted.amount;

              await addDoc(collection(db, 'expenses'), {
                userId: profile?.uid,
                emailId: email.id,
                amount: extractedAmount,
                currency: extractedCurrency,
                merchant: extracted.merchant || 'Unknown',
                category: extracted.category || 'Other',
                date: extracted.date || format(new Date(), 'yyyy-MM-dd'),
                description: extracted.description || 'E-posta Faturası',
                isCorporate: !!extracted.isCorporatePotential,
                createdAt: serverTimestamp(),
                syncStatus: 'pending'
              });
              added++;
            }
          }
          newProcessedIds.push(email.id); // Mark AI parse success
          processedIds.add(email.id);
          
          if (profile) {
              const updatedProcessedIds = [...(profile.processedEmailIds || []), email.id].slice(-1000);
              await setDoc(doc(db, 'users', profile.uid), { ...profile, processedEmailIds: updatedProcessedIds });
              profile.processedEmailIds = updatedProcessedIds;
          }

          // AI Studio limits API calls. To prevent 429 Resource Exhausted, we must enforce a ~15 Requests Per Minute limit.
          await new Promise(resolve => setTimeout(resolve, 6500));
        } catch (aiErr: any) {
          console.error("Email parsing error:", aiErr);
          const errMsg = aiErr?.message || "";
          if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            throw new Error("Yapay zeka API kota limitine ulaşıldı. Lütfen daha sonra tekrar senkronize edin.");
          }
        }
      }

      if (profile && newProcessedIds.length > 0) {
        // Fallback or final update is handled incrementally now, but we can do one final flush if needed
        // Keep the last 1000 processed IDs to avoid blowing up the Firestore document size
        const currentStored = profile.processedEmailIds || [];
        if (newProcessedIds.some(id => !currentStored.includes(id))) {
           const updatedProcessedIds = [...new Set([...currentStored, ...newProcessedIds])].slice(-1000);
           await setDoc(doc(db, 'users', profile.uid), { ...profile, processedEmailIds: updatedProcessedIds });
           // Object mutation handles local state tracking for now
           profile.processedEmailIds = updatedProcessedIds;
        }
      }

      setSyncMessage(`${added} yeni işlem eklendi! ${skipped ? `(${skipped} ilgisiz/eski e-posta atlandı)` : ''}`);
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (e: any) {
      const isPopupClosed = e?.message?.includes('popup-closed');
      if (!isPopupClosed) {
        console.error(e);
      }
      let errMsg = e.message || 'Senkronizasyon başarısız. İzinleri kontrol edin.';
      if (isPopupClosed) {
        errMsg = 'Erişim verilmedi veya işlem iptal edildi.';
      } else if (errMsg.includes('Gmail API has not been used')) {
        errMsg = 'Gmail API kapalı. Google Cloud Console\'dan Gmail API\'yi etkinleştirin.';
      }
      setSyncMessage(errMsg);
      setTimeout(() => setSyncMessage(''), 8000);
    } finally {
      setSyncingEmails(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      className="space-y-xl"
    >
      {/* Balance Card */}
      <div className="bg-primary border border-primary-container rounded-xl p-6 relative overflow-hidden shadow-[0px_8px_24px_rgba(13,71,161,0.15)]">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <span className="material-symbols-outlined text-[80px]">pie_chart</span>
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="font-label-md text-label-md text-on-primary-container uppercase tracking-wider mb-2">Aylık Bütçe</p>
              <h2 className="font-display-lg text-display-lg text-on-primary">{formatCurrency(profile?.monthlyIncome || 0, profile?.currency || 'TRY')}</h2>
            </div>
            <div className="flex bg-surface-container-lowest/20 rounded-full p-1 border border-white/20 backdrop-blur-sm shadow-sm">
               <button onClick={() => setMonthOffset(prev => prev - 1)} disabled={monthOffset === -11} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-90 ${monthOffset === -11 ? 'text-white/30 cursor-not-allowed' : 'text-white hover:bg-white/20'}`}><span className="material-symbols-outlined">chevron_left</span></button>
               <div className="px-3 flex items-center justify-center min-w-[100px] font-label-md text-label-md text-white capitalize">{format(targetMonthDate, 'MMMM yyyy', { locale: tr })}</div>
               <button onClick={() => setMonthOffset(prev => prev + 1)} disabled={monthOffset === 0} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-90 ${monthOffset === 0 ? 'text-white/30 cursor-not-allowed' : 'text-white hover:bg-white/20'}`}><span className="material-symbols-outlined">chevron_right</span></button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-surface-container-lowest/10 rounded-lg border border-white/10 backdrop-blur-sm">
              <div className="flex justify-between font-label-md text-label-md mb-2">
                 <span className="text-on-primary-container">Harcanan{profile?.monthlyIncome ? ` (${((totalSpent/profile.monthlyIncome)*100).toFixed(0)}%)` : ''}</span>
                 <span className="font-bold text-white">{formatCurrency(totalSpent, profile?.currency || 'TRY')}</span>
              </div>
              <div className="w-full bg-surface-container-lowest/20 h-2 rounded-full overflow-hidden">
                 <div className="bg-error h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(profile?.monthlyIncome ? (totalSpent/profile.monthlyIncome)*100 : 0, 100)}%` }}></div>
              </div>
            </div>
            <div className="p-4 bg-surface-container-lowest/10 rounded-lg border border-white/10 backdrop-blur-sm">
              <div className="flex justify-between font-label-md text-label-md mb-2">
                 <span className="text-on-primary-container">Kalan</span>
                 <span className="font-bold text-white">{formatCurrency(remaining, profile?.currency || 'TRY')}</span>
              </div>
              <div className="w-full bg-surface-container-lowest/20 h-2 rounded-full overflow-hidden">
                 <div className="bg-tertiary-fixed h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(profile?.monthlyIncome ? (remaining/profile.monthlyIncome)*100 : 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_4px_12px_rgba(13,71,161,0.05)] border border-surface-variant">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Harcama Analizi</h3>
            <p className="font-body-sm text-body-sm text-outline capitalize">{format(targetMonthDate, 'MMMM yyyy', { locale: tr })} Özeti</p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-surface-container rounded-full font-label-md text-label-md text-on-surface-variant">Tümü</div>
          </div>
        </div>
        <div className="h-48 mb-lg flex items-center justify-center px-2">
            {Object.keys(categoryData).length > 0 ? (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
                    className="w-full h-full"
                    key={JSON.stringify(categoryData)}
                >
                    <Pie 
                        data={{
                          labels: Object.keys(categoryData),
                          datasets: [{
                            data: Object.values(categoryData),
                            backgroundColor: [
                              '#006099', '#2e79b5', '#496079', '#8a4d00', '#ba1a1a', '#01629d'
                            ],
                            borderWidth: 0,
                          }]
                        }} 
                        options={{ 
                            plugins: { legend: { display: false } },
                            maintainAspectRatio: false,
                            animation: {
                                animateScale: true,
                                animateRotate: true,
                                duration: 1000,
                                easing: 'easeOutExpo'
                            }
                        }} 
                    />
                </motion.div>
            ) : (
                <p className="font-body-sm text-body-sm text-outline text-center w-full">Henüz veri yok. İşlem ekleyin.</p>
            )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(categoryData).slice(0, 4).map(([cat, val]: any, i) => {
            const budget = profile?.budgets?.[cat];
            const pct = budget ? Math.min((val / budget) * 100, 100) : 0;
            return (
            <div key={cat} className="bg-surface-container rounded-lg p-4 border border-surface-variant flex flex-col justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant block mb-1 uppercase tracking-wider">Kategori {i + 1}</span>
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-body-md font-medium text-on-surface truncate mr-2" title={cat}>{cat}</span>
                  <span className="font-label-md text-label-md text-primary">{formatCurrency(val, profile?.currency || 'TRY')} {budget ? `/ ${formatCurrency(budget, profile?.currency || 'TRY')}` : ''}</span>
                </div>
              </div>
              {budget ? (
                <div className="w-full bg-surface-container-high rounded-full h-2 mt-3">
                  <div className={`h-2 rounded-full ${pct > 90 ? 'bg-error' : pct > 75 ? 'bg-tertiary' : 'bg-primary'}`} style={{ width: `${pct}%` }}></div>
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
            <span className="material-symbols-outlined text-[18px]">business_center</span> YZ Vergi Analizi
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-4">
            Bu ay {corporateExpenses.length} adet kurumsal işleminiz var. Potansiyel vergi indirimi: <span className="font-body-md text-body-md font-bold text-on-surface">{formatCurrency(corporateExpenses.reduce((s, e) => s + e.amount, 0), profile?.currency || 'TRY')}</span>
          </p>
          <button 
             onClick={() => setActiveTab('insights')}
             className="w-full py-3 bg-surface-container-lowest border border-surface-variant hover:bg-surface-container-low text-on-surface rounded-lg font-label-md text-label-md transition-colors active:scale-95 shadow-sm"
          >
            Vergi Öngörülerini Gör
          </button>
        </div>
      )}

      {/* Recent List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">İşlemler</h3>
        <div className="space-y-4">
          {currentMonthExpenses.length > 0 ? currentMonthExpenses.slice(0, 5).map(exp => (
            <ExpenseItem key={exp.id} expense={exp} />
          )) : <p className="text-sm text-slate-500">Bu ay hiç işlem yok.</p>}
        </div>
      </div>
    </motion.div>
  );
}

function ExpenseListView({ expenses, profile }: { expenses: Expense[], profile: UserProfile | null }) {
  const [filterType, setFilterType] = useState<'All' | 'Personal' | 'Corporate'>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredExpenses = expenses.filter(exp => {
    if (filterType === 'Personal' && exp.isCorporate) return false;
    if (filterType === 'Corporate' && !exp.isCorporate) return false;
    
    if (filterCategory !== 'All' && exp.category !== filterCategory) return false;

    if (dateFrom && exp.date < dateFrom) return false;
    if (dateTo && exp.date > dateTo) return false;

    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeB === timeA) {
       return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
    }
    return timeB - timeA;
  });

  // UI level deduplication for existing duplicates in the database
  const seenIds = new Set<string>();
  const deduplicatedFilteredExpenses = filteredExpenses.filter(e => {
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
      <div className="flex flex-col gap-4">
        {/* Search Bar - Simulated conceptually matching the design */}
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl py-3 pl-12 pr-4 font-body-md text-on-surface focus:outline-none focus:border-primary shadow-sm transition-all" 
            placeholder="Search transactions..." 
            type="text"
            // Note: implementing search functionality is a bonus, leaving as placeholder for styling purposes
          />
        </div>

        {/* Filters array like the design */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setFilterType('All')} className={`flex items-center gap-2 border border-surface-variant rounded-full px-4 py-2 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === 'All' ? 'bg-primary-fixed text-on-primary-fixed border-transparent' : 'bg-surface-container-lowest text-on-surface'}`}>
             <span className="material-symbols-outlined text-[18px]">filter_list</span>
             <span className="font-label-md">Tümü</span>
          </button>
          <button onClick={() => setFilterType('Personal')} className={`flex items-center gap-2 border border-surface-variant rounded-full px-4 py-2 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === 'Personal' ? 'bg-primary-fixed text-on-primary-fixed border-transparent' : 'bg-surface-container-lowest text-on-surface'}`}>
             <span className="material-symbols-outlined text-[18px]">person</span>
             <span className="font-label-md">Kişisel</span>
          </button>
          <button onClick={() => setFilterType('Corporate')} className={`flex items-center gap-2 border border-surface-variant rounded-full px-4 py-2 hover:bg-surface-container-lowest transition-colors whitespace-nowrap shadow-sm active:scale-95 ${filterType === 'Corporate' ? 'bg-primary-fixed text-on-primary-fixed border-transparent' : 'bg-surface-container-lowest text-on-surface'}`}>
             <span className="material-symbols-outlined text-[18px]">business</span>
             <span className="font-label-md">İş</span>
          </button>
          
          <div className="flex items-center justify-center border-l border-surface-variant pl-4 ml-2 gap-2 shrink-0">
             <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-surface-container-lowest border border-surface-variant rounded-lg p-1 text-xs text-on-surface outline-none focus:border-primary h-8" />
             <span className="text-outline text-xs">-</span>
             <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-surface-container-lowest border border-surface-variant rounded-lg p-1 text-xs text-on-surface outline-none focus:border-primary h-8" />
             <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-surface-container-lowest border border-surface-variant rounded-lg p-1 text-xs text-on-surface outline-none focus:border-primary h-8 max-w-[100px]">
                <option value="All">Kategori</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
             </select>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-[0px_4px_12px_rgba(13,71,161,0.05)] overflow-hidden">
        {deduplicatedFilteredExpenses.length === 0 && (
          <div className="text-center py-20">
             <span className="material-symbols-outlined text-[48px] text-surface-dim mb-4">receipt_long</span>
             <p className="font-body-md text-on-surface-variant">Filtrelerinizle eşleşen işlem yok.</p>
          </div>
        )}
        {deduplicatedFilteredExpenses.map((exp) => (
          <ExpenseItem key={exp.id} expense={exp} detail />
        ))}
      </div>
    </motion.div>
  );
}



function InsightsView({ expenses, profile }: { expenses: Expense[], profile: UserProfile | null }) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const resp = await generateMonthlyReport(expenses.slice(0, 20), profile?.monthlyIncome || 0, profile?.isCorporate || false);
      setReport(resp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-lg pt-4"
    >
      <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 flex flex-col shadow-[0px_4px_12px_rgba(49,124,184,0.08)] relative overflow-hidden">
        <span className="material-symbols-outlined absolute top-8 right-8 text-primary/10 text-[120px] select-none pointer-events-none">insights</span>
        <div className="flex items-center gap-2 mb-4 relative z-10">
          <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-primary">auto_awesome</span>
          </div>
          <h3 className="font-label-md text-primary uppercase tracking-wider">Gemini Finansal Analiz</h3>
        </div>
        <div className="relative z-10 w-full md:w-2/3">
          <p className="font-body-md text-on-surface-variant leading-relaxed">
            Harcamalarınızı yapay zeka ile analiz ederek kişiselleştirilmiş tasarruf fırsatları keşfedebilir,
            {profile?.isCorporate ? ' vergi indirimi potansiyeli taşıyan kalemleri detaylandırabilirsiniz.' : ' bütçe optimizasyonu için eyleme geçirilebilir öneriler alabilirsiniz.'}
          </p>
          <div className="mt-lg pt-4 border-t border-surface-variant flex">
            <button 
              onClick={generate}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-on-primary rounded-full px-6 py-3 font-label-md transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                 <>
                   <span className="material-symbols-outlined animate-spin-slow">change_circle</span>
                   Veriler analiz ediliyor...
                 </>
              ) : (
                 <>
                   <span className="material-symbols-outlined">analytics</span>
                   Finansal Rapor Oluştur
                 </>
              )}
            </button>
          </div>
        </div>
      </div>

      {report ? (
        <div className="bg-surface border border-surface-variant rounded-xl p-6 prose max-w-none prose-sm text-on-surface prose-headings:text-primary prose-a:text-tertiary">
           <Markdown>{report}</Markdown>
        </div>
      ) : (
        <div className="text-center py-24 px-10 bg-surface-container-lowest rounded-xl border border-surface-variant border-dashed">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xs">
            <span className="material-symbols-outlined text-[32px] text-surface-dim">trending_up</span>
          </div>
          <p className="font-body-md text-on-surface-variant max-w-sm mx-auto">Detaylı finansal öngörüler, tasarruf fırsatları ve bütçe ipuçları için rapor oluşturun.</p>
        </div>
      )}
    </motion.div>
  );
}

function EditableCategoryBadge({ cat, onDelete, onSave }: { cat: string, onDelete: () => void, onSave: (val: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(cat);

  if (isEditing) {
    return (
      <form 
        onSubmit={(e) => { e.preventDefault(); onSave(val.trim()); setIsEditing(false); }}
        className="flex items-center bg-white/10 rounded-full pl-2 pr-1 h-8"
      >
        <input 
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { onSave(val.trim()); setIsEditing(false); }}
          className="bg-transparent outline-none text-sm w-32 text-white"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-white/10 pl-3 pr-1 py-1 rounded-full text-sm hover:bg-white/15 transition-colors group">
      <span className="cursor-pointer" onClick={() => setIsEditing(true)}>{cat}</span>
      <button 
        onClick={onDelete}
        className="p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <X className="w-3 h-3 text-slate-400 hover:text-red-400" />
      </button>
    </div>
  );
}

function SettingsView({ profile, toggleCorporate }: { profile: UserProfile | null, toggleCorporate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-lg pt-4"
    >
      <section className="flex flex-col items-center pt-4 pb-4">
        <div className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-[0px_4px_12px_rgba(49,124,184,0.08)] bg-surface-container border-4 border-surface font-bold text-[32px] flex items-center justify-center text-primary-container">
          <span className="material-symbols-outlined text-[64px] text-surface-dim">account_circle</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">{profile?.displayName}</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {profile?.email}
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-lg">
          <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <h3 className="font-label-md text-label-md text-primary mb-4 uppercase tracking-wider">Mali Bilgiler</h3>
            <div className="space-y-4">
               <div>
                 <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Aylık Gelir</label>
                 <input 
                   type="number"
                   defaultValue={profile?.monthlyIncome}
                   onBlur={async (e) => {
                     const val = parseFloat(e.target.value);
                     if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, monthlyIncome: val });
                   }}
                   className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl p-3 font-body-md text-on-surface outline-none focus:border-primary transition-colors focus:ring-1 focus:ring-primary shadow-sm"
                 />
               </div>
               <div>
                 <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Para Birimi</label>
                 <select 
                   value={profile?.currency || 'TRY'}
                   onChange={async (e) => {
                     const val = e.target.value;
                     if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, currency: val });
                   }}
                   className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl p-3 font-body-md text-on-surface outline-none focus:border-primary transition-colors appearance-none focus:ring-1 focus:ring-primary shadow-sm"
                 >
                   {COMMON_CURRENCIES.map(c => (
                     <option key={c} value={c}>{c}</option>
                   ))}
                 </select>
               </div>
             </div>
           </section>

           <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-label-md text-label-md text-tertiary uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">business_center</span> Kurumsal Hesap
              </h3>
              <button 
                onClick={toggleCorporate}
                className={`w-12 h-6 rounded-full relative transition-colors focus:outline-none shrink-0 ${profile?.isCorporate ? 'bg-tertiary-container' : 'bg-surface-variant'}`}
              >
                <motion.div 
                  animate={{ x: profile?.isCorporate ? 24 : 2 }}
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
            <p className="font-body-sm text-on-surface-variant">Kurumsal vergi optimizasyonu ve iş harcamaları özelliklerini etkinleştirin.</p>
          </section>
        </div>

        <div className="space-y-lg">
          <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <h3 className="font-label-md text-label-md text-primary mb-4 uppercase tracking-wider">Kategoriler & Bütçeler</h3>
            <div className="flex flex-col gap-3 mb-6">
               {(profile?.categories || DEFAULT_CATEGORIES).map((cat, i) => (
                 <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full bg-surface border border-surface-variant rounded-lg p-3">
                   <div className="flex-1">
                     <EditableCategoryBadge 
                       cat={cat} 
                       onDelete={async () => {
                         if (!profile) return;
                         const newCats = (profile.categories || DEFAULT_CATEGORIES).filter((_, idx) => idx !== i);
                         await setDoc(doc(db, 'users', profile.uid), { ...profile, categories: newCats });
                       }}
                       onSave={async (newVal) => {
                         if (!profile) return;
                         if (!newVal || newVal === cat) return;
                         const newCats = [...(profile.categories || DEFAULT_CATEGORIES)];
                         if (newCats.includes(newVal)) return;
                         newCats[i] = newVal;
                         const newBudgets = { ...(profile.budgets || {}) };
                         if (newBudgets[cat]) {
                           newBudgets[newVal] = newBudgets[cat];
                           delete newBudgets[cat];
                         }
                         await setDoc(doc(db, 'users', profile.uid), { ...profile, categories: newCats, budgets: newBudgets });
                       }}
                     />
                   </div>
                   <div className="flex items-center gap-2">
                      <label className="font-label-md text-on-surface-variant truncate">Bütçe ({profile?.currency || 'TRY'}):</label>
                      <input 
                        type="number"
                        min="0"
                        placeholder="Limitsiz"
                        value={profile?.budgets?.[cat] || ''}
                        onChange={async (e) => {
                           if (!profile) return;
                           const newBudgets = { ...(profile.budgets || {}) };
                           const val = parseInt(e.target.value);
                           if (isNaN(val) || val <= 0) {
                             delete newBudgets[cat];
                           } else {
                             newBudgets[cat] = val;
                           }
                           await setDoc(doc(db, 'users', profile.uid), { ...profile, budgets: newBudgets });
                        }}
                        className="w-24 bg-surface-container border border-surface-variant rounded-md px-2 py-1 font-body-sm text-on-surface outline-none focus:border-primary transition-colors focus:ring-1 focus:ring-primary h-[32px]"
                      />
                   </div>
                 </div>
               ))}
             </div>
             <form 
               onSubmit={async (e) => {
                 e.preventDefault();
                 if (!profile) return;
                 const form = e.target as HTMLFormElement;
                 const input = form.elements.namedItem('newCategory') as HTMLInputElement;
                 const val = input.value.trim();
                 if (val && !(profile.categories || DEFAULT_CATEGORIES).includes(val)) {
                   const newCats = [...(profile.categories || DEFAULT_CATEGORIES), val];
                   await setDoc(doc(db, 'users', profile.uid), { ...profile, categories: newCats });
                   input.value = '';
                 }
               }}
               className="flex gap-2"
             >
               <input 
                 name="newCategory"
                 placeholder="Yeni Kategori..."
                 className="flex-1 bg-surface-container-lowest border border-surface-variant rounded-lg p-3 font-body-sm text-on-surface outline-none focus:border-primary transition-colors focus:ring-1 focus:ring-primary shadow-sm"
               />
               <button 
                 type="submit"
                 className="px-4 py-3 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-label-md transition-colors shadow-sm"
               >
                 Ekle
               </button>
             </form>
          </section>

          <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <div>
              <h3 className="font-label-md text-label-md text-primary mb-2 uppercase tracking-wider">E-posta Fatura Senkronizasyonu</h3>
              <p className="font-body-sm text-on-surface-variant mb-4">Gmail'inizde e-fatura ve makbuz arama yöntemini yapılandırın.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Senkronizasyon Sıklığı</label>
                  <select 
                    value={profile?.syncFrequency || '6months'}
                    onChange={async (e) => {
                      const val = e.target.value;
                      if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncFrequency: val });
                    }}
                    className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl p-3 font-body-md text-on-surface outline-none focus:border-primary transition-colors appearance-none focus:ring-1 focus:ring-primary shadow-sm"
                  >
                    <option value="daily">Günlük</option>
                    <option value="weekly">Haftalık</option>
                    <option value="monthly">Aylık</option>
                    <option value="3months">Son 3 Ay (Tam Tarama)</option>
                    <option value="6months">Son 6 Ay (Tam Tarama)</option>
                    <option value="manual">Sadece Manuel</option>
                  </select>
                  <p className="font-label-md text-outline mt-1">Makbuzların ne sıklıkla taranmasını istersiniz.</p>
                </div>
                
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Özel Gmail Etiketleri (İsteğe Bağlı)</label>
                  <input 
                    type="text"
                    placeholder="örneğin makbuzlar, satın alımlar"
                    defaultValue={profile?.syncLabels || ''}
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncLabels: val });
                    }}
                    className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl p-3 font-body-md text-on-surface outline-none focus:border-primary transition-colors focus:ring-1 focus:ring-primary shadow-sm"
                  />
                  <p className="font-label-md text-outline mt-1">Taramayı belirli Gmail etiketleriyle sınırlandırın (virgülle ayrılmış).</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <div>
              <h3 className="font-label-md text-label-md text-error mb-2 uppercase tracking-wider">E-posta Senkronizasyonunu Sıfırla</h3>
              <p className="font-body-sm text-on-surface-variant mb-4">E-postalardan aktarılan tüm harcamaları siler ve e-posta geçmişini temizler. Daha önce okunan e-postalar tekrar taranabilir hale gelir. Manuel eklediğiniz harcamalar silinmez.</p>
              
              <button 
                 onClick={async () => {
                   if (!profile) return;
                   if (!window.confirm("E-postalardan aktarılan tüm harcama kayıtlarını silmek ve e-posta senkronizasyon geçmişini temizlemek istediğinize emin misiniz?")) return;
                   
                   try {
                     const q = query(collection(db, 'expenses'), where('userId', '==', profile.uid));
                     const snapshot = await getDocs(q);
                     const batch = writeBatch(db);
                     let deletedCount = 0;
                     snapshot.docs.forEach((docSnap) => {
                       if (docSnap.data().emailId) {
                         batch.delete(docSnap.ref);
                         deletedCount++;
                       }
                     });
                     if (deletedCount > 0) {
                       await batch.commit();
                     }

                     await setDoc(doc(db, 'users', profile.uid), { ...profile, processedEmailIds: [] });
                     
                     alert('E-posta kaynaklı harcamalar silindi ve e-posta arama geçmişi sıfırlandı.');
                   } catch (err) {
                     handleFirestoreError(err, OperationType.DELETE, 'expenses');
                   }
                 }}
                 className="w-full py-3 rounded-lg border border-error bg-error/10 text-error font-label-md hover:bg-error/20 transition-colors shadow-sm"
              >
                E-posta Harcamalarını Sıfırla
              </button>
            </div>
          </section>

          <button 
             onClick={logout}
             className="w-full py-3 rounded-lg border border-error/30 text-error font-label-md hover:bg-error-container/10 transition-colors mt-lg shadow-sm"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AddExpenseModal({ onClose, userId, profile, isCorporateDefault, categories }: { onClose: () => void, userId: string, profile: UserProfile | null, isCorporateDefault: boolean, categories: string[] }) {
  const [loading, setLoading] = useState(false);
  const [isCorporate, setIsCorporate] = useState(isCorporateDefault);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [currency, setCurrency] = useState(profile?.currency || 'TRY');

  const [formData, setFormData] = useState({
    amount: '',
    merchant: '',
    category: categories.includes('Other') ? 'Other' : (categories[0] || ''),
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setUseCamera(true);
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Kamera erişimi reddedildi veya kullanılamıyor.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseCamera(false);
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64String = canvas.toDataURL('image/jpeg').split(',')[1];
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
        date: extracted.date ? extracted.date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
        description: extracted.description || ''
      });
      if (extracted.currency && COMMON_CURRENCIES.includes(extracted.currency.toUpperCase())) {
          setCurrency(extracted.currency.toUpperCase());
      }
      if (extracted.isCorporatePotential) setIsCorporate(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
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
      const expenseData: any = {
        userId,
        merchant: formData.merchant,
        category: formData.category,
        amount: parsedAmount,
        currency,
        date: formData.date,
        description: formData.description,
        isCorporate,
        createdAt: serverTimestamp(),
      };

      if (isRecurring) {
        expenseData.isRecurring = true;
        expenseData.recurrenceInterval = recurrenceInterval;
        let nextDate = new Date(formData.date);
        if (recurrenceInterval === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (recurrenceInterval === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (recurrenceInterval === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        expenseData.nextRecurrenceDate = nextDate.toISOString().split('T')[0];
      }

      await addDoc(collection(db, 'expenses'), expenseData);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-on-background/50 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-surface w-[100vw] sm:w-[512px] shrink-0 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 border-t sm:border border-surface-variant shadow-[0px_8px_24px_rgba(49,124,184,0.12)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline-md text-headline-md text-on-surface">İşlem Ekle</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-variant transition-colors"><span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span></button>
        </div>

        {!useCamera ? (
          <div className="mb-6 grid grid-cols-2 gap-4">
            <button type="button" onClick={startCamera} className="h-32 border border-dashed border-primary/50 bg-primary-container/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-primary-container/20 transition-colors group">
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined">photo_camera</span>
              </div>
              <p className="font-label-md text-primary">Kamerayı Kullan</p>
            </button>
            <label className="h-32 border border-dashed border-primary/50 bg-primary-container/10 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-primary-container/20 transition-colors group">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined">upload</span>
              </div>
              <p className="font-label-md text-primary">Dosya Yükle</p>
            </label>
          </div>
        ) : (
          <div className="mb-6 relative rounded-2xl overflow-hidden bg-black w-full min-h-[300px] h-[50vh] max-h-[450px] shadow-inner">
            <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-3">
              <button type="button" onClick={stopCamera} className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-xl text-sm font-semibold transition-colors">İptal</button>
              <button type="button" onClick={captureImage} className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-sm font-bold flex-1 transition-colors">Fotoğraf Çek</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Tutar</label>
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-numeric-lg text-numeric-lg text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                  />
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-24 bg-surface-container border border-surface-variant rounded-xl p-3 text-on-surface outline-none focus:border-primary appearance-none font-label-md font-bold text-center shadow-sm"
                  >
                    {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
             </div>
             <div className="w-32">
                <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Tür</label>
                <button 
                  type="button"
                  onClick={() => setIsCorporate(!isCorporate)}
                  className={`w-full h-[54px] rounded-xl flex items-center justify-center gap-2 border transition-all shadow-sm ${isCorporate ? 'bg-tertiary-container border-tertiary-container text-on-tertiary-container' : 'bg-surface-container border-surface-variant text-on-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">{isCorporate ? 'business_center' : 'person'}</span>
                  <span className="font-label-md font-bold">{isCorporate ? 'İş' : 'Kişisel'}</span>
                </button>
             </div>
          </div>

          <div>
             <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Satıcı / İşletme</label>
             <input 
               required
               placeholder="Mağaza, Hizmet, Restoran..."
               value={formData.merchant}
               onChange={e => setFormData({ ...formData, merchant: e.target.value })}
               className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Kategori</label>
               <select 
                 value={formData.category}
                 onChange={e => setFormData({ ...formData, category: e.target.value })}
                 className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm appearance-none"
               >
                 {categories.map(c => (
                   <option key={c} value={c}>{c}</option>
                 ))}
               </select>
            </div>
            <div>
               <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Tarih</label>
               <input 
                 type="date"
                 value={formData.date}
                 onChange={e => setFormData({ ...formData, date: e.target.value })}
                 className="w-full bg-surface-container-lowest rounded-xl p-3 border border-surface-variant font-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
               />
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3 border border-surface-variant">
             <label className="flex items-center gap-3 cursor-pointer">
               <input 
                 type="checkbox" 
                 checked={isRecurring}
                 onChange={e => setIsRecurring(e.target.checked)}
                 className="w-5 h-5 accent-primary rounded bg-surface-container-lowest border-surface-variant"
               />
               <span className="font-body-md font-medium text-on-surface">Düzenli Gider</span>
             </label>
             {isRecurring && (
               <div className="pl-8">
                 <select
                   value={recurrenceInterval}
                   onChange={e => setRecurrenceInterval(e.target.value as 'monthly' | 'weekly' | 'yearly')}
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
                 <span className="material-symbols-outlined animate-spin-slow">sync</span>
                 İşleniyor...
               </>
            ) : 'İşlemi Kaydet'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
