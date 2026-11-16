export type Currency = 'LKR' | 'USD' | 'EUR' | 'GBP' | 'ILS';

export type AccountType = 'cash' | 'bank' | 'credit_card';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: Currency;
  category: string;
  description: string;
  date: string;
  toAccountId?: string;
}

export interface Investment {
  id: string;
  name: string;
  type: 'stock' | 'gold' | 'fixed_deposit';
  value: number;
  invested: number;
  currency: Currency;
}

export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  emiAmount: number;
  dueDate: number;
  currency: Currency;
}

export const EXCHANGE_RATES: Record<Currency, number> = {
  LKR: 1,
  USD: 325,
  EUR: 355,
  GBP: 410,
  ILS: 97.87,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ILS: '₪',
};

export const mockAccounts: Account[] = [
  { id: '1', name: 'Wallet', type: 'cash', balance: 15400, currency: 'LKR', icon: 'Wallet', color: 'primary' },
  { id: '2', name: 'BOC Savings', type: 'bank', balance: 485000, currency: 'LKR', icon: 'Building2', color: 'success' },
  { id: '3', name: 'Commercial Bank', type: 'bank', balance: 1250000, currency: 'LKR', icon: 'Building2', color: 'gradient-end' },
  { id: '4', name: 'USD Account', type: 'bank', balance: 2340, currency: 'USD', icon: 'DollarSign', color: 'warning' },
  { id: '5', name: 'Visa Platinum', type: 'credit_card', balance: -78500, currency: 'LKR', icon: 'CreditCard', color: 'destructive' },
];

export const mockTransactions: Transaction[] = [
  { id: '1', accountId: '2', type: 'expense', amount: 3500, currency: 'LKR', category: 'Food', description: 'Groceries - Keells Super', date: '2026-03-01' },
  { id: '2', accountId: '3', type: 'income', amount: 175000, currency: 'LKR', category: 'Salary', description: 'Monthly Salary', date: '2026-02-28' },
  { id: '3', accountId: '1', type: 'expense', amount: 850, currency: 'LKR', category: 'Transport', description: 'PickMe Ride', date: '2026-02-28' },
  { id: '4', accountId: '5', type: 'expense', amount: 12500, currency: 'LKR', category: 'Shopping', description: 'Amazon Purchase', date: '2026-02-27' },
  { id: '5', accountId: '2', type: 'transfer', amount: 10000, currency: 'LKR', category: 'Transfer', description: 'ATM Withdrawal', date: '2026-02-27', toAccountId: '1' },
  { id: '6', accountId: '4', type: 'income', amount: 500, currency: 'USD', category: 'Freelance', description: 'Upwork Payment', date: '2026-02-26' },
  { id: '7', accountId: '1', type: 'expense', amount: 1200, currency: 'LKR', category: 'Food', description: 'Lunch - Ministry of Crab', date: '2026-02-25' },
  { id: '8', accountId: '3', type: 'expense', amount: 45000, currency: 'LKR', category: 'Utilities', description: 'CEB Electricity Bill', date: '2026-02-24' },
  { id: '9', accountId: '2', type: 'expense', amount: 8900, currency: 'LKR', category: 'Health', description: 'Pharmacy - Osu Sala', date: '2026-02-23' },
  { id: '10', accountId: '5', type: 'expense', amount: 35000, currency: 'LKR', category: 'Entertainment', description: 'Netflix + Spotify Annual', date: '2026-02-22' },
];

export const mockInvestments: Investment[] = [
  { id: '1', name: 'Dialog Axiata PLC', type: 'stock', value: 125000, invested: 100000, currency: 'LKR' },
  { id: '2', name: 'Gold Sovereign', type: 'gold', value: 380000, invested: 320000, currency: 'LKR' },
  { id: '3', name: 'BOC Fixed Deposit', type: 'fixed_deposit', value: 550000, invested: 500000, currency: 'LKR' },
];

export const mockDebts: Debt[] = [
  { id: '1', name: 'Home Loan', totalAmount: 5000000, remainingAmount: 3200000, emiAmount: 45000, dueDate: 5, currency: 'LKR' },
  { id: '2', name: 'Vehicle Lease', totalAmount: 1800000, remainingAmount: 960000, emiAmount: 28000, dueDate: 15, currency: 'LKR' },
];

export const spendingByCategory = [
  { name: 'Food', value: 4700, color: 'hsl(173, 80%, 40%)' },
  { name: 'Transport', value: 850, color: 'hsl(199, 89%, 48%)' },
  { name: 'Shopping', value: 12500, color: 'hsl(38, 92%, 50%)' },
  { name: 'Utilities', value: 45000, color: 'hsl(142, 71%, 45%)' },
  { name: 'Health', value: 8900, color: 'hsl(280, 65%, 60%)' },
  { name: 'Entertainment', value: 35000, color: 'hsl(0, 72%, 51%)' },
];

export const netWorthTrend = [
  { month: 'Sep', value: 2100000 },
  { month: 'Oct', value: 2250000 },
  { month: 'Nov', value: 2180000 },
  { month: 'Dec', value: 2400000 },
  { month: 'Jan', value: 2550000 },
  { month: 'Feb', value: 2680000 },
];

export function formatCurrency(amount: number, currency: Currency = 'LKR'): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) {
    return `${amount < 0 ? '-' : ''}${symbol}${(absAmount / 1000000).toFixed(2)}M`;
  }
  if (absAmount >= 1000) {
    return `${amount < 0 ? '-' : ''}${symbol}${absAmount.toLocaleString()}`;
  }
  return `${amount < 0 ? '-' : ''}${symbol}${absAmount}`;
}

export function convertToBase(amount: number, fromCurrency: Currency): number {
  return amount * EXCHANGE_RATES[fromCurrency];
}
