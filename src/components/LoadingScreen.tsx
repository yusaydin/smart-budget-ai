import { motion } from 'framer-motion';
import { Receipt } from 'lucide-react';

export const LoadingScreen = () => (
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
