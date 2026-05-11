import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Settings, 
  LogOut, 
  Camera, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingDown,
  Sparkles,
  Info,
  ChevronRight,
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
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { extractExpenseFromImage, generateMonthlyReport, getCorporateAdvice, extractExpenseFromEmail } from './services/gemini';
import { fetchRecentReceiptEmails } from './services/gmail';
import { format } from 'date-fns';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import Markdown from 'react-markdown';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

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
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  isCorporate: boolean;
  monthlyIncome: number;
  currency: string;
  categories?: string[];
  syncFolders?: string; // legacy
  syncFrequencyDays?: number; // legacy
  syncLabels?: string;
  syncFrequency?: 'daily' | 'weekly' | 'monthly' | 'manual';
}

const DEFAULT_CATEGORIES = ['Food', 'Commute', 'Office', 'Entertainment', 'Health', 'Travel', 'Utilities', 'Taxes', 'Subscription', 'Other'];

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
    <p className="text-slate-500 text-sm mt-2">Starting Engine...</p>
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
          Master your money.
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400"
        >
          AI-powered tracking, categorization, and tax optimization for personal and corporate use.
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
        Continue with Google
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
            const newProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'User',
              isCorporate: false,
              monthlyIncome: 0,
              currency: 'TRY',
              categories: DEFAULT_CATEGORIES,
              syncLabels: '',
              syncFrequency: 'weekly'
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
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none mt-0.5">Gemini Active</span>
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
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Home" />
        <NavButton active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt />} label="List" />
        <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<PieChart />} label="AI" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Misc" />
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
            description: rec.description || `Recurring (${rec.merchant})`,
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
          frequency: profile?.syncFrequency || 'weekly',
          folder: profile?.syncLabels || profile?.syncFolders || ''
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
      let added = 0;
      for (const email of emails) {
        const extractedResults = await extractExpenseFromEmail(email.text, email.pdfAttachments || [], cats);
        for (const extracted of extractedResults) {
          if (extracted && extracted.amount > 0) {
            await addDoc(collection(db, 'expenses'), {
              userId: profile?.uid,
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
      }
      setSyncMessage(`${added} yeni işlem senkronize edildi!`);
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
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Monthly Budget</p>
              <h2 className="text-3xl font-bold text-white">₺{(profile?.monthlyIncome || 0).toLocaleString()}</h2>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex justify-between text-xs mb-2">
                 <span className="text-slate-400">Spent{profile?.monthlyIncome ? ` (${((totalSpent/profile.monthlyIncome)*100).toFixed(0)}%)` : ''}</span>
                 <span className="font-medium text-white">₺{totalSpent.toLocaleString()}</span>
              </div>
              <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                 <div className="bg-violet-500 h-full" style={{ width: `${Math.min(profile?.monthlyIncome ? (totalSpent/profile.monthlyIncome)*100 : 0, 100)}%` }}></div>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex justify-between text-xs mb-2">
                 <span className="text-slate-400">Remaining</span>
                 <span className="font-medium text-white">₺{remaining.toLocaleString()}</span>
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
          <h3 className="text-violet-400 text-xs font-bold uppercase tracking-wider">E-Invoice Sync</h3>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {syncMessage || 'Sync receipts directly from your linked Gmail account using AI.'}
        </p>
        <button 
           onClick={handleSyncEmails}
           disabled={syncingEmails}
           className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {syncingEmails ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Chart Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Spending Analysis</h3>
            <p className="text-sm text-slate-400 capitalize">{format(new Date(), 'MMMM yyyy')} Overview</p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-white/10 rounded text-xs text-white">All</div>
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
                <p className="text-slate-500 text-sm">No data yet. Add an expense.</p>
            )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(categoryData).slice(0, 4).map(([cat, val]: any, i) => (
            <div key={cat} className="bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Category {i + 1}</span>
              <div className="flex justify-between items-center">
                <span className="font-medium truncate mr-2" title={cat}>{cat}</span>
                <span className="text-sm font-bold text-slate-300">₺{val.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Corporate Summary */}
      {profile?.isCorporate && (
        <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-5">
          <h3 className="text-violet-400 text-xs font-bold uppercase tracking-wider mb-3">Tax AI Analysis</h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            You have {corporateExpenses.length} corporate items this month. Potential tax deductions: <span className="font-bold text-white">₺{corporateExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
          </p>
          <button 
             onClick={() => setActiveTab('insights')}
             className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            View Tax Insights
          </button>
        </div>
      )}

      {/* Recent List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Transactions</h3>
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
          <h2 className="text-2xl font-semibold">Transactions</h2>
          <div className="flex bg-white/5 rounded-xl p-1">
            <button onClick={() => setFilterType('All')} className={`px-4 py-2 rounded-lg text-xs font-medium ${filterType === 'All' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white transition-colors'}`}>All</button>
            <button onClick={() => setFilterType('Personal')} className={`px-4 py-2 rounded-lg text-xs font-medium ${filterType === 'Personal' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white transition-colors'}`}>Personal</button>
            <button onClick={() => setFilterType('Corporate')} className={`px-4 py-2 rounded-lg text-xs font-medium ${filterType === 'Corporate' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white transition-colors'}`}>Work</button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Category</label>
            <select 
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full bg-slate-800 rounded-lg p-2 border border-white/10 text-white outline-none focus:border-violet-500/50 appearance-none text-xs"
            >
              <option value="All">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">From</label>
            <input 
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-slate-800 rounded-lg p-2 border border-white/10 text-white outline-none focus:border-violet-500/50 text-xs [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">To</label>
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
        {filteredExpenses.length === 0 && (
          <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
            <Receipt className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400">No transactions match your filters.</p>
          </div>
        )}
        {filteredExpenses.map(exp => (
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
          <span className="text-xs font-bold text-slate-300">-₺{expense.amount.toLocaleString()}</span>
          <div className="flex gap-1">
            {expense.isCorporate && <div className="px-1.5 py-0.5 rounded bg-violet-500/20 text-[8px] font-bold text-violet-400 uppercase">Corp</div>}
            {expense.isRecurring && <div className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[8px] font-bold text-cyan-400 uppercase">{expense.recurrenceInterval === 'yearly' ? 'Yr' : expense.recurrenceInterval === 'weekly' ? 'Wk' : 'Mo'}</div>}
          </div>
        </div>
      </div>
      
      {detail && expense.isCorporate && (
        <div className="mt-4 pt-4 border-t border-white/5">
          {advice ? (
            <div className="text-[11px] text-violet-200/70 leading-relaxed bg-violet-500/10 p-3 rounded-lg border border-violet-500/20">
              <div className="flex items-center gap-1.5 mb-1 text-violet-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Tax Advice</span>
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
              {loadingAdvice ? 'Analyzing...' : 'Get AI Tax Insight'}
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
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-tighter">Gemini Insight Engine</h3>
        </div>
        <div className="relative z-10">
          <p className="text-slate-300 text-sm leading-relaxed max-w-[280px] italic">
            "I can analyze your transactions to find savings opportunities and, if applicable, flag items for tax deduction."
          </p>
          <div className="mt-6 pt-4 border-t border-white/10">
            <button 
              onClick={generate}
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-lg text-sm font-bold transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? 'Analyzing data...' : 'Run Financial Analysis'}
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
          <p className="text-gray-500 text-sm">Analyze your patterns to find savings opportunities and tax benefits.</p>
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
      <h2 className="text-2xl font-semibold mb-8 text-white">Settings</h2>
      
      <div className="space-y-4">
        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-violet-500/20 text-violet-500 rounded-2xl flex items-center justify-center">
               <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-white">Corporate Account</h4>
              <p className="text-xs text-slate-500">Enable tax optimization features</p>
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
             <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Monthly Income (₺)</label>
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
             <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-4 font-bold">Custom Categories</label>
             <div className="flex flex-wrap gap-2 mb-6">
               {(profile?.categories || DEFAULT_CATEGORIES).map((cat, i) => (
                 <EditableCategoryBadge 
                   key={i} 
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
                     await setDoc(doc(db, 'users', profile.uid), { ...profile, categories: newCats });
                   }}
                 />
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
                 placeholder="New Category..."
                 className="flex-1 bg-white/5 rounded-xl px-4 py-3 border border-white/10 text-white outline-none focus:border-violet-500/50 transition-colors text-sm"
               />
               <button 
                 type="submit"
                 className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition-colors text-sm"
               >
                 Add
               </button>
             </form>
           </div>
        </div>

        <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-6">
           <div>
             <h4 className="font-semibold text-white mb-2">Email Receipt Sync</h4>
             <p className="text-xs text-slate-500 mb-4">Configure how we search your Gmail for e-receipts and invoices.</p>
             
             <div className="space-y-4">
               <div>
                 <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Sync Frequency</label>
                 <select 
                   value={profile?.syncFrequency || 'weekly'}
                   onChange={async (e) => {
                     const val = e.target.value;
                     if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncFrequency: val });
                   }}
                   className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50 transition-colors appearance-none"
                 >
                   <option value="daily">Daily</option>
                   <option value="weekly">Weekly</option>
                   <option value="monthly">Monthly</option>
                   <option value="3months">Last 3 Months (Full Scan)</option>
                   <option value="manual">Manual Only</option>
                 </select>
                 <p className="text-[10px] text-slate-500 mt-1">How often you want to scan for receipts.</p>
               </div>
               
               <div>
                 <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Specific Gmail Labels (Optional)</label>
                 <input 
                   type="text"
                   placeholder="e.g. receipts, purchases"
                   defaultValue={profile?.syncLabels || profile?.syncFolders || ''}
                   onBlur={async (e) => {
                     const val = e.target.value.trim();
                     if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncLabels: val });
                   }}
                   className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50 transition-colors"
                 />
                 <p className="text-[10px] text-slate-500 mt-1">Limit scanning to specific Gmail labels (comma-separated).</p>
               </div>
             </div>
           </div>
        </div>

        <button 
           onClick={logout}
           className="w-full py-4 rounded-3xl border border-red-500/20 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors mt-8"
        >
          Logout
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
      alert("Camera access denied or not available.");
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
          <h2 className="text-xl font-semibold">Add Transaction</h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        {!useCamera ? (
          <div className="mb-8 grid grid-cols-2 gap-4">
            <button type="button" onClick={startCamera} className="h-32 border-2 border-dashed border-white/10 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="text-cyan-500 w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 group-hover:text-cyan-500 transition-colors">Use Camera</p>
            </button>
            <label className="h-32 border-2 border-dashed border-white/10 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-colors group">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="text-cyan-500 w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 group-hover:text-cyan-500 transition-colors">Upload File</p>
            </label>
          </div>
        ) : (
          <div className="mb-8 relative rounded-[1.5rem] overflow-hidden bg-black aspect-[4/3] flex flex-col shadow-inner">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-3">
              <button type="button" onClick={stopCamera} className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-xl text-sm font-semibold transition-colors">Cancel</button>
              <button type="button" onClick={captureImage} className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl text-sm font-bold flex-1 transition-colors">Capture</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Amount (₺)</label>
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
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Type</label>
                <button 
                  type="button"
                  onClick={() => setIsCorporate(!isCorporate)}
                  className={`w-full h-[60px] rounded-xl flex items-center justify-center gap-2 border transition-all ${isCorporate ? 'bg-violet-500/10 border-violet-500 text-violet-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                >
                  {isCorporate ? <Briefcase className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  <span className="text-[10px] font-bold uppercase">{isCorporate ? 'Work' : 'Pers'}</span>
                </button>
             </div>
          </div>

          <div>
             <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Merchant</label>
             <input 
               required
               placeholder="Store, Service, Restaurant..."
               value={formData.merchant}
               onChange={e => setFormData({ ...formData, merchant: e.target.value })}
               className="w-full bg-white/5 rounded-xl p-4 border border-white/10 text-white outline-none focus:border-violet-500/50"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Category</label>
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
               <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">Date</label>
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
               <span className="text-sm font-bold text-white">Recurring Expense</span>
             </label>
             {isRecurring && (
               <div className="pl-8">
                 <select
                   value={recurrenceInterval}
                   onChange={e => setRecurrenceInterval(e.target.value as 'monthly' | 'weekly' | 'yearly')}
                   className="w-full bg-white/5 rounded-xl p-3 border border-white/10 text-white outline-none focus:border-violet-500/50 appearance-none text-sm"
                 >
                   <option value="weekly">Weekly</option>
                   <option value="monthly">Monthly</option>
                   <option value="yearly">Yearly</option>
                 </select>
               </div>
             )}
          </div>

          <button 
             disabled={loading}
             className="w-full py-4 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-2xl font-bold hover:brightness-110 transition-all shadow-xl shadow-violet-500/20 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Save Transaction'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
