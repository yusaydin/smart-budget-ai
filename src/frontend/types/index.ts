export interface Expense {
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
  syncStatus?: 'pending' | 'confirmed';
  originalAmount?: number;
  originalCurrency?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  phone?: string;
  displayName: string;
  photoURL?: string;
  isCorporate: boolean;
  monthlyIncome: number;
  currency: string;
  autoConvertCurrency?: boolean;
  categories?: string[];
  syncLabels?: string;
  syncFrequency?: 'daily' | 'weekly' | 'monthly' | '3months' | '6months' | 'manual';
  processedEmailIds?: string[];
  budgets?: Record<string, number>;
  theme?: 'light' | 'dark' | 'system';
}
