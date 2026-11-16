import { motion } from "framer-motion";
import { TrendingUp, Wallet, Landmark, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { formatCurrency, Currency } from "@/lib/data";
import { useAccounts } from "@/hooks/useAccounts";
import { useInvestments } from "@/hooks/useInvestments";
import { useDebts } from "@/hooks/useDebts";
import { useConvertToBase, useExchangeRates } from "@/hooks/useExchangeRates";

export function NetWorthWidget() {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: investments = [], isLoading: loadingInvestments } = useInvestments();
  const { data: debts = [], isLoading: loadingDebts } = useDebts();
  const convertToBase = useConvertToBase();

  const loading = loadingAccounts || loadingInvestments || loadingDebts;

  const totalCash = accounts
    .filter((a) => a.type !== "credit_card")
    .reduce((sum, a) => sum + convertToBase(a.balance, a.currency as Currency), 0);

  const totalInvestments = investments.reduce(
    (sum, i) => sum + convertToBase(i.value, i.currency as Currency), 0
  );

  const totalDebts = debts.reduce(
    (sum, d) => sum + convertToBase(d.remaining_amount, d.currency as Currency), 0
  );

  const creditCardDebt = Math.abs(
    accounts
      .filter((a) => a.type === "credit_card")
      .reduce((sum, a) => sum + convertToBase(a.balance, a.currency as Currency), 0)
  );

  const netWorth = totalCash + totalInvestments - totalDebts - creditCardDebt;

  const items = [
    { label: "Cash & Bank", value: totalCash, icon: Wallet, positive: true },
    { label: "Investments", value: totalInvestments, icon: Landmark, positive: true },
    { label: "Debts", value: totalDebts + creditCardDebt, icon: CreditCard, positive: false },
  ];

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[140px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6 glow"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-muted-foreground font-medium">Net Worth</span>
        <div className="flex items-center gap-1 text-success text-xs font-medium">
          <TrendingUp className="h-3 w-3" />
          Live
        </div>
      </div>

      <p className="text-3xl font-bold gradient-text font-mono tracking-tight">
        {formatCurrency(netWorth)}
      </p>

      <div className="grid grid-cols-3 gap-3 mt-5">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="flex items-center justify-center mb-1.5">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className={`text-sm font-semibold font-mono ${item.positive ? "text-foreground" : "text-destructive"}`}>
              {formatCurrency(item.value)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
