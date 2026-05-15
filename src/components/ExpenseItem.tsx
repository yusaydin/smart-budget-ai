import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Expense } from '../types';
import { formatCurrency } from '../lib/utils';
import { getCorporateAdvice } from '../services/gemini';

export function ExpenseItem({ expense, detail = false }: { expense: Expense, detail?: boolean }) {
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
    <div className="flex items-center justify-between p-4 border-b border-surface-variant hover:bg-surface-bright transition-colors cursor-pointer group last:border-0 relative">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform ${expense.isCorporate ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'}`}>
           {expense.merchant.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h4 className="font-body-md text-on-surface font-medium truncate max-w-[120px] sm:max-w-xs flex items-center gap-1.5">
            {expense.merchant}
            {expense.isRecurring && <span className="material-symbols-outlined text-[14px] text-primary">event_repeat</span>}
          </h4>
          <p className="font-body-sm text-outline flex items-center gap-1">
            <span>{format(new Date(expense.date), 'MMM d', { locale: tr })}</span>
            <span>•</span>
            <span>{expense.category}</span>
          </p>
        </div>
      </div>
      <div className="text-right flex flex-col items-end gap-1">
        <div className="flex flex-col items-end">
          <span className="font-numeric-lg text-numeric-lg text-error">-{formatCurrency(expense.amount, expense.currency)}</span>
          {expense.originalAmount && expense.originalCurrency && expense.originalCurrency !== expense.currency && (
            <span className="text-label-md text-outline font-medium">({formatCurrency(expense.originalAmount, expense.originalCurrency)})</span>
          )}
        </div>
        <div className="flex gap-1 mt-0.5">
          {expense.isCorporate && <div className="px-2 py-0.5 rounded-full bg-tertiary-container/10 text-[10px] font-bold text-tertiary uppercase">Kurumsal</div>}
          {expense.isRecurring && <div className="px-2 py-0.5 rounded-full bg-primary-container/10 text-[10px] font-bold text-primary uppercase">{expense.recurrenceInterval === 'yearly' ? 'Yıl' : expense.recurrenceInterval === 'weekly' ? 'Hafta' : 'Ay'}</div>}
        </div>
      </div>
      
      {detail && expense.isCorporate && (
        <div className="w-full left-0 mt-4 pt-4 border-t border-surface-variant flex-col items-start hidden">
          {/* Note: expanding logic can be implemented, hidden for default state */}
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
