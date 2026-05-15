import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export const AuthScreen = () => (
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
