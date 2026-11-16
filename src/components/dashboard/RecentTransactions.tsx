import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Loader2 } from "lucide-react";
import { formatCurrency, Currency } from "@/lib/data";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";

const typeConfig = {
  income: { icon: ArrowDownLeft, colorClass: "text-success", bgClass: "bg-success/10" },
  expense: { icon: ArrowUpRight, colorClass: "text-destructive", bgClass: "bg-destructive/10" },
  transfer: { icon: ArrowRightLeft, colorClass: "text-primary", bgClass: "bg-primary/10" },
};

export function RecentTransactions() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const recent = transactions.slice(0, 6);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">
          Recent Transactions
        </h3>
        <a href="/transactions" className="text-xs text-primary hover:underline">View All</a>
      </div>

      {recent.length === 0 ? (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground">
          No transactions yet.
        </div>
      ) : (
        <div className="glass-card divide-y divide-border">
          {recent.map((tx, i) => {
            const config = typeConfig[tx.type as keyof typeof typeConfig] || typeConfig.expense;
            const Icon = config.icon;
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="flex items-center gap-3 p-3.5 hover:bg-secondary/30 transition-colors"
              >
                <div className={`h-8 w-8 rounded-lg ${config.bgClass} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${config.colorClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tx.type === "transfer"
                      ? `${accounts.find(a => a.id === tx.account_id)?.name || "Account"} → ${accounts.find(a => a.id === tx.to_account_id)?.name || "Account"}`
                      : tx.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {tx.type === "transfer" ? tx.date : `${tx.category} · ${tx.date}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold font-mono ${tx.type === "income" ? "text-success" : tx.type === "expense" ? "text-destructive" : "text-foreground"}`}>
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                    {formatCurrency(tx.amount, (accounts.find(a => a.id === tx.account_id)?.currency || tx.currency) as Currency)}
                  </p>
                  {tx.type === "transfer" && (
                    <p className="text-[10px] text-muted-foreground">
                      → {formatCurrency(tx.amount * (tx.exchange_rate || 1) - (tx.transfer_charge || 0), (accounts.find(a => a.id === tx.to_account_id)?.currency || tx.currency) as Currency)}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
