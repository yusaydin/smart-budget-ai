import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Settings, 
  LogOut, 
  Camera, 
  TrendingDown,
  Sparkles,
  X,
  Upload,
  User as UserIcon,
  Briefcase,
  Mail,
  Repeat
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
  updateDoc
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { extractExpenseFromImage, generateMonthlyReport, getCorporateAdvice, extractExpenseFromEmail } from './services/gemini';
import { fetchRecentReceiptEmails } from './services/gmail';
import { format } from 'date-fns';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import Markdown from 'react-markdown';

ChartJS.register(ArcElement, Tooltip, Legend);

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY' }).format(amount);
  } catch (e) {
    return `${currency || 'TRY'} ${amount.toLocaleString()}`;
  }
}

// --- Types ---
interface Expense {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  description: string;
  merchant: string;
  isCorporate: boolean;
  createdAt: any;
  isRecurring?: boolean;
  recurrenceInterval?: 'monthly' | 'weekly' | 'yearly';
  nextRecurrenceDate?: string;
  parentId?: string;
  emailId?: string;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  isCorporate: boolean;
  monthlyIncome: number;
  currency: string;
  categories?: string[];
  syncLabels?: string;
  syncFrequency?: 'daily' | 'weekly' | 'monthly' | 'manual';
  processedEmailIds?: string[];
  budgets?: Record<string, number>;
}

const DEFAULT_CATEGORIES = ['Yemek', 'Ulaşım', 'Ofis', 'Eğlence', 'Sağlık', 'Seyahat', 'Faturalar', 'Vergi', 'Abonelik', 'Diğer'];

// --- Components ---

const LoadingScreen = () => (
  <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center z-50">
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
      className="mb-8"
    >
      <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.4)]">
        <Receipt className="text-white w-8 h-8" />
      </div>
    </motion.div>
    <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">BudgetAI</h2>
    <p className="text-slate-500 text-sm mt-2">Sistem Başlatılıyor...</p>
  </div>
);

const AuthScreen = () => (
  <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6">
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-[0_0_30px_rgba(139,92,246,0.4)]"
        >
          <Sparkles className="text-white w-8 h-8" />
        </motion.div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-4xl font-semibold text-white tracking-tight"
        >
          Paranıza Hükmedin.
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400"
        >
          Kişisel ve kurumsal kullanım için yapay zeka destekli takip, kategorizasyon ve vergi optimizasyonu.
        </motion.p>
      </div>

      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={signInWithGoogle}
        className="w-full py-4 bg-white text-slate-900 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-colors shadow-xl"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
        Google ile Devam Et
      </motion.button>
    </div>
  </div>
);

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
              syncFrequency: 'monthly'
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

  return (
    <div className="min-h-screen bg-[#050507] text-slate-200 font-sans selection:bg-violet-500/30 pb-24">
      {/* Header */}
      <header className="px-6 py-8 flex items-center justify-between sticky top-0 bg-[#050507]/80 backdrop-blur-xl z-30 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)]">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">BudgetAI</h1>
            <p className="text-xs text-slate-400 capitalize">{activeTab}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none mt-0.5">Gemini Aktif</span>
          </div>
          <button 
            onClick={logout}
            className="w-10 h-10 rounded-full border border-white/20 bg-slate-800 flex items-center justify-center overflow-hidden hover:bg-slate-700 transition"
          >
            {user?.photoURL ? <img src={user.photoURL} alt="User" className="w-full h-full object-cover" /> : <LogOut className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 max-w-2xl mx-auto py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard profile={profile} expenses={expenses} setActiveTab={setActiveTab} key="dashboard" />}
          {activeTab === 'expenses' && <ExpenseListView expenses={expenses} profile={profile} key="expenses" />}
          {activeTab === 'insights' && <InsightsView expenses={expenses} profile={profile} key="insights" />}
          {activeTab === 'settings' && <SettingsView profile={profile} key="settings" toggleCorporate={toggleCorporate} />}
        </AnimatePresence>
      </main>

      {/* Fab */}
      <div className="fixed bottom-28 right-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAddModalOpen(true)}
          className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-2xl shadow-cyan-500/20"
        >
          <Plus className="w-7 h-7" />
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="fixed bottom-8 left-6 right-6 h-16 bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/10 px-6 flex items-center justify-between z-40 shadow-2xl">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Ana Sayfa" />
        <NavButton active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt />} label="Liste" />
        <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<PieChart />} label="Yapay Zeka" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Ayarlar" />
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddExpenseModal 
            onClose={() => setIsAddModalOpen(false)} 
            userId={user.uid} 
            isCorporateDefault={profile?.isCorporate || false} 
            categories={profile?.categories || DEFAULT_CATEGORIES}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Components ---

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={`p-2 transition-colors transition-transform ${active ? 'text-violet-500 scale-110' : 'text-slate-500'}`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' })}
      </div>
      <span className={`text-[10px] font-bold tracking-wide ${active ? 'text-violet-500' : 'text-slate-500'}`}>
        {label}
      </span>
    </button>
  );
}

function Dashboard({ profile, expenses, setActiveTab }: { profile: UserProfile | null, expenses: Expense[], setActiveTab: (tab: any) => void }) {
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
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
          frequency: profile?.syncFrequency || 'monthly',
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
          const extractedResults = await extractExpenseFromEmail(`Subject: ${email.subject || 'No Subject'}\n\n${email.text}`, email.pdfAttachments || [], cats);
          
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

              await addDoc(collection(db, 'expenses'), {
                userId: profile?.uid,
                emailId: email.id,
                amount: typeof extracted.amount === 'string' ? parseFloat(extracted.amount) : extracted.amount,
                merchant: extracted.merchant || 'Unknown',
                category: extracted.category || 'Other',
                date: extracted.date || format(new Date(), 'yyyy-MM-dd'),
                description: extracted.description || 'E-posta Faturası',
                isCorporate: !!extracted.isCorporatePotential,
                currency: extracted.currency || profile?.currency || 'TRY',
                createdAt: serverTimestamp()
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
      console.error(e);
      let errMsg = e.message || 'Senkronizasyon başarısız. İzinleri kontrol edin.';
      if (errMsg.includes('Gmail API has not been used')) {
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
      className="space-y-8"
    >
      {/* Balance Card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <PieChart className="w-16 h-16" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Aylık Bütçe</p>
              <h2 className="text-3xl font-bold text-white">{formatCurrency(profile?.monthlyIncome || 0, profile?.currency || 'TRY')}</h2>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex justify-between text-xs mb-2">
                 <span className="text-slate-400">Harcanan{profile?.monthlyIncome ? ` (${((totalSpent/profile.monthlyIncome)*100).toFixed(0)}%)` : ''}</span>
                 <span className="font-medium text-white">{formatCurrency(totalSpent, profile?.currency || 'TRY')}</span>
              </div>
              <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                 <div className="bg-violet-500 h-full" style={{ width: `${Math.min(profile?.monthlyIncome ? (totalSpent/profile.monthlyIncome)*100 : 0, 100)}%` }}></div>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex justify-between text-xs mb-2">
                 <span className="text-slate-400">Kalan</span>
                 <span className="font-medium text-white">{formatCurrency(remaining, profile?.currency || 'TRY')}</span>
              </div>
              <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                 <div className="bg-cyan-500 h-full" style={{ width: `${Math.min(profile?.monthlyIncome ? (remaining/profile.monthlyIncome)*100 : 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* E-Invoice Sync */}
      <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
            <Mail className="w-4 h-4 text-violet-400" />
          </div>
          <h3 className="text-violet-400 text-xs font-bold uppercase tracking-wider">E-Fatura Senkronizasyonu</h3>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {syncMessage || 'Bağlı Gmail hesabınızdan makbuzları yapay zeka kullanarak doğrudan senkronize edin.'}
        </p>
        <button 
           onClick={handleSyncEmails}
           disabled={syncingEmails}
           className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {syncingEmails ? 'Senkronize Ediliyor...' : 'Şimdi Senkronize Et'}
        </button>
      </div>

      {/* Chart Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Harcama Analizi</h3>
            <p className="text-sm text-slate-400 capitalize">{format(new Date(), 'MMMM yyyy')} Özeti</p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-white/10 rounded text-xs text-white">Tümü</div>
          </div>
        </div>
        <div className="h-48 mb-8 flex items-center justify-center px-2">
            {Object.keys(categoryData).length > 0 ? (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
                    className="w-full h-full"
                    key={JSON.stringify(categoryData)} // Force re-mount on data change for full animation effect
                >
                    <Pie 
                        data={{
                          labels: Object.keys(categoryData),
                          datasets: [{
                            data: Object.values(categoryData),
                            backgroundColor: [
                              '#8b5cf6', '#06b6d4', '#6366f1', '#f43f5e', '#ec4899', '#f59e0b'
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
                <p className="text-slate-500 text-sm">Henüz veri yok. İşlem ekleyin.</p>
            )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(categoryData).slice(0, 4).map(([cat, val]: any, i) => {
            const budget = profile?.budgets?.[cat];
            const pct = budget ? Math.min((val / budget) * 100, 100) : 0;
            return (
            <div key={cat} className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Kategori {i + 1}</span>
                <div className="flex justify-between items-center">
                  <span className="font-medium truncate mr-2" title={cat}>{cat}</span>
                  <span className="text-sm font-bold text-slate-300">{formatCurrency(val, profile?.currency || 'TRY')} {budget ? `/ ${formatCurrency(budget, profile?.currency || 'TRY')}` : ''}</span>
                </div>
              </div>
              {budget ? (
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-3">
                  <div className={`h-1.5 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }}></div>
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      </div>

      {/* Corporate Summary */}
      {profile?.isCorporate && (
        <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-5">
          <h3 className="text-violet-400 text-xs font-bold uppercase tracking-wider mb-3">YZ Vergi Analizi</h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            Bu ay {corporateExpenses.length} adet kurumsal işleminiz var. Potansiyel vergi indirimi: <span className="font-bold text-white">{formatCurrency(corporateExpenses.reduce((s, e) => s + e.amount, 0), profile?.currency || 'TRY')}</span>
          </p>
          <button 
             onClick={() => setActiveTab('insights')}
             className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Vergi Öngörülerini Gör
          </button>
        </div>
      )}

      {/* Recent List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Son İşlemler</h3>
        <div className="space-y-4">
          {expenses.slice(0, 5).map(exp => (
            <ExpenseItem key={exp.id} expense={exp} />
          ))}
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">İşlemler</h2>
          <div className="flex bg-white/5 rounded-xl p-1">
            <button onClick={() => setFilterType('All')} className={`px-4 py-2 rounded-lg text-xs font-medium ${filterType === 'All' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white transition-colors'}`}>Tümü</button>
            <button onClick={() => setFilterType('Personal')} className={`px-4 py-2 rounded-lg text-xs font-medium ${filterType === 'Personal' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white transition-colors'}`}>Kişisel</button>
            <button onClick={() => setFilterType('Corporate')} className={`px-4 py-2 rounded-lg text-xs font-medium ${filterType === 'Corporate' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white transition-colors'}`}>İş</button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Kategori</label>
            <select 
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full bg-slate-800 rounded-lg p-2 border border-white/10 text-white outline-none focus:border-violet-500/50 appearance-none text-xs"
            >
              <option value="All">Tüm Kategoriler</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Başlangıç</label>
            <input 
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-slate-800 rounded-lg p-2 border border-white/10 text-white outline-none focus:border-violet-500/50 text-xs [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Bitiş</label>
            <input 
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-slate-800 rounded-lg p-2 border border-white/10 text-white outline-none focus:border-violet-500/50 text-xs [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {deduplicatedFilteredExpenses.length === 0 && (
          <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
            <Receipt className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400">Filtrelerinizle eşleşen işlem yok.</p>
          </div>
        )}
        {deduplicatedFilteredExpenses.map(exp => (
          <ExpenseItem key={exp.id} expense={exp} detail />
        ))}
      </div>
    </motion.div>
  );
}

function ExpenseItem({ expense, detail = false }: { expense: Expense, detail?: boolean }) {
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
    <div className="p-2 transition-all group border-b border-white/5 last:border-0 rounded-lg hover:bg-white/5">
      <div className="flex gap-3 items-center justify-between">
        <div className="flex gap-3 items-center">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${expense.isCorporate ? 'bg-violet-500/20 text-violet-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
             {expense.merchant.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 truncate max-w-[120px] sm:max-w-xs flex items-center gap-1.5">
              {expense.merchant}
              {expense.isRecurring && <Repeat className="w-3 h-3 text-cyan-500" />}
            </h4>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <span>{format(new Date(expense.date), 'MMM d')}</span>
              <span>•</span>
              <span>{expense.category}</span>
            </p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <span className="text-xs font-bold text-slate-300">-{formatCurrency(expense.amount, expense.currency)}</span>
          <div className="flex gap-1">
            {expense.isCorporate && <div className="px-1.5 py-0.5 rounded bg-violet-500/20 text-[8px] font-bold text-violet-400 uppercase">Kurumsal</div>}
            {expense.isRecurring && <div className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[8px] font-bold text-cyan-400 uppercase">{expense.recurrenceInterval === 'yearly' ? 'Yıl' : expense.recurrenceInterval === 'weekly' ? 'Hafta' : 'Ay'}</div>}
          </div>
        </div>
      </div>
      
      {detail && expense.isCorporate && (
        <div className="mt-4 pt-4 border-t border-white/5">
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
      className="space-y-8"
    >
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-6 flex flex-col shadow-2xl relative overflow-hidden">
        <Sparkles className="absolute top-8 right-8 text-cyan-500/20 w-16 h-16" />
        <div className="flex items-center gap-2 mb-4 relative z-10">
          <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-tighter">Gemini Öngörü Motoru</h3>
        </div>
        <div className="relative z-10">
          <p className="text-slate-300 text-sm leading-relaxed max-w-[280px] italic">
            "İşlemlerinizi analiz ederek tasarruf fırsatları bulabilir ve uygun durumlarda vergi indirimi için kalemleri işaretleyebilirim."
          </p>
          <div className="mt-6 pt-4 border-t border-white/10">
            <button 
              onClick={generate}
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-lg text-sm font-bold transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? 'Veriler analiz ediliyor...' : 'Finansal Analizi Başlat'}
            </button>
          </div>
        </div>
      </div>

      {report ? (
        <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 prose prose-invert max-w-none prose-sm text-gray-300">
           <Markdown>{report}</Markdown>
        </div>
      ) : (
        <div className="text-center py-20 px-10">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <TrendingDown className="text-gray-600 w-8 h-8" />
          </div>
          <p className="text-gray-500 text-sm">Tasarruf fırsatları ve vergi avantajları bulmak için alışkanlıklarınızı analiz edin.</p>
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
      className="space-y-6"
    >
      <h2 className="text-2xl font-semibold mb-8 text-white">Ayarlar</h2>
      
      <div className="space-y-4">
        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-violet-500/20 text-violet-500 rounded-2xl flex items-center justify-center">
               <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-white">Kurumsal Hesap</h4>
              <p className="text-xs text-slate-500">Vergi optimizasyonu özelliklerini etkinleştirin</p>
            </div>
          </div>
          <button 
            onClick={toggleCorporate}
            className={`w-12 h-6 rounded-full transition-colors relative ${profile?.isCorporate ? 'bg-violet-600' : 'bg-slate-700'}`}
          >
            <motion.div 
              animate={{ x: profile?.isCorporate ? 24 : 4 }}
              className="absolute top-1 w-4 h-4 bg-white rounded-full"
            />
          </button>
        </div>

        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
           <div>
             <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Aylık Gelir (₺)</label>
             <input 
               type="number"
               defaultValue={profile?.monthlyIncome}
               onBlur={async (e) => {
                 const val = parseFloat(e.target.value);
                 if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, monthlyIncome: val });
               }}
               className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50 transition-colors"
             />
           </div>
        </div>

        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
           <div>
             <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-4 font-bold">Özel Kategoriler & Bütçeler</label>
             <div className="flex flex-col gap-3 mb-6">
               {(profile?.categories || DEFAULT_CATEGORIES).map((cat, i) => (
                 <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full bg-white/5 rounded-xl p-3 border border-white/10">
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
                      <label className="text-xs text-slate-400">Aylık Bütçe (₺):</label>
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
                        className="w-24 bg-white/10 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-violet-500 transition-colors"
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
                 className="flex-1 bg-white/5 rounded-xl px-4 py-3 border border-white/10 text-white outline-none focus:border-violet-500/50 transition-colors text-sm"
               />
               <button 
                 type="submit"
                 className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition-colors text-sm"
               >
                 Ekle
               </button>
             </form>
           </div>
        </div>

        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-6">
           <div>
             <h4 className="font-semibold text-white mb-2">E-posta Fatura Senkronizasyonu</h4>
             <p className="text-xs text-slate-500 mb-4">Gmail'inizde e-fatura ve makbuz arama yöntemini yapılandırın.</p>
             
             <div className="space-y-4">
               <div>
                 <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Senkronizasyon Sıklığı</label>
                 <select 
                   value={profile?.syncFrequency || 'monthly'}
                   onChange={async (e) => {
                     const val = e.target.value;
                     if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncFrequency: val });
                   }}
                   className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50 transition-colors appearance-none"
                 >
                   <option value="daily">Günlük</option>
                   <option value="weekly">Haftalık</option>
                   <option value="monthly">Aylık</option>
                   <option value="3months">Son 3 Ay (Tam Tarama)</option>
                   <option value="manual">Sadece Manuel</option>
                 </select>
                 <p className="text-[10px] text-slate-500 mt-1">Makbuzların ne sıklıkla taranmasını istersiniz.</p>
               </div>
               
               <div>
                 <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Özel Gmail Etiketleri (İsteğe Bağlı)</label>
                 <input 
                   type="text"
                   placeholder="örneğin makbuzlar, satın alımlar"
                   defaultValue={profile?.syncLabels || ''}
                   onBlur={async (e) => {
                     const val = e.target.value.trim();
                     if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncLabels: val });
                   }}
                   className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50 transition-colors"
                 />
                 <p className="text-[10px] text-slate-500 mt-1">Taramayı belirli Gmail etiketleriyle sınırlandırın (virgülle ayrılmış).</p>
               </div>
             </div>
           </div>
        </div>

        <button 
           onClick={logout}
           className="w-full py-4 rounded-3xl border border-red-500/20 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors mt-8"
        >
          Çıkış Yap
        </button>
      </div>
    </motion.div>
  );
}

function AddExpenseModal({ onClose, userId, isCorporateDefault, categories }: { onClose: () => void, userId: string, isCorporateDefault: boolean, categories: string[] }) {
  const [loading, setLoading] = useState(false);
  const [isCorporate, setIsCorporate] = useState(isCorporateDefault);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');

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
      const expenseData: any = {
        userId,
        amount: parseFloat(formData.amount),
        currency: 'TRY',
        merchant: formData.merchant,
        category: formData.category,
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-md"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-[#0f0f0f] w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 border-t sm:border border-white/10 text-white max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold">İşlem Ekle</h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        {!useCamera ? (
          <div className="mb-8 grid grid-cols-2 gap-4">
            <button type="button" onClick={startCamera} className="h-32 border-2 border-dashed border-white/10 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="text-cyan-500 w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 group-hover:text-cyan-500 transition-colors">Kamerayı Kullan</p>
            </button>
            <label className="h-32 border-2 border-dashed border-white/10 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-colors group">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="text-cyan-500 w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 group-hover:text-cyan-500 transition-colors">Dosya Yükle</p>
            </label>
          </div>
        ) : (
          <div className="mb-8 relative rounded-[1.5rem] overflow-hidden bg-black aspect-[4/3] flex flex-col shadow-inner">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-3">
              <button type="button" onClick={stopCamera} className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-xl text-sm font-semibold transition-colors">İptal</button>
              <button type="button" onClick={captureImage} className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl text-sm font-bold flex-1 transition-colors">Fotoğraf Çek</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Tutar (₺)</label>
                <input 
                  autoFocus
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-xl font-bold outline-none focus:border-violet-500/50"
                />
             </div>
             <div className="w-32">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Tür</label>
                <button 
                  type="button"
                  onClick={() => setIsCorporate(!isCorporate)}
                  className={`w-full h-[60px] rounded-xl flex items-center justify-center gap-2 border transition-all ${isCorporate ? 'bg-violet-500/10 border-violet-500 text-violet-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                >
                  {isCorporate ? <Briefcase className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  <span className="text-[10px] font-bold uppercase">{isCorporate ? 'İş' : 'Kişisel'}</span>
                </button>
             </div>
          </div>

          <div>
             <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Satıcı / İşletme</label>
             <input 
               required
               placeholder="Mağaza, Hizmet, Restoran..."
               value={formData.merchant}
               onChange={e => setFormData({ ...formData, merchant: e.target.value })}
               className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Kategori</label>
               <select 
                 value={formData.category}
                 onChange={e => setFormData({ ...formData, category: e.target.value })}
                 className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50 appearance-none"
               >
                 {categories.map(c => (
                   <option key={c} value={c}>{c}</option>
                 ))}
               </select>
            </div>
            <div>
               <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Tarih</label>
               <input 
                 type="date"
                 value={formData.date}
                 onChange={e => setFormData({ ...formData, date: e.target.value })}
                 className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50"
               />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
             <label className="flex items-center gap-3 cursor-pointer">
               <input 
                 type="checkbox" 
                 checked={isRecurring}
                 onChange={e => setIsRecurring(e.target.checked)}
                 className="w-5 h-5 accent-violet-500 rounded bg-white/10 border-white/10"
               />
               <span className="text-sm font-bold text-white">Düzenli Gider</span>
             </label>
             {isRecurring && (
               <div className="pl-8">
                 <select
                   value={recurrenceInterval}
                   onChange={e => setRecurrenceInterval(e.target.value as 'monthly' | 'weekly' | 'yearly')}
                   className="w-full bg-white/5 rounded-xl p-3 border border-white/10 text-white outline-none focus:border-violet-500/50 appearance-none text-sm"
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
             className="w-full py-4 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-2xl font-bold hover:brightness-110 transition-all shadow-xl shadow-violet-500/20 disabled:opacity-50"
          >
            {loading ? 'İşleniyor...' : 'İşlemi Kaydet'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
