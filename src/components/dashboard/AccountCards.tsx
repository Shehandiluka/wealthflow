import { motion } from "framer-motion";
import { Wallet, Building2, CreditCard, DollarSign, Loader2 } from "lucide-react";
import { formatCurrency, Currency } from "@/lib/data";
import { useAccounts } from "@/hooks/useAccounts";

const iconMap: Record<string, React.ElementType> = {
  Wallet, Building2, CreditCard, DollarSign,
};

export function AccountCards() {
  const { data: accounts = [], isLoading } = useAccounts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">Accounts</h3>
        <div className="glass-card p-6 text-center text-sm text-muted-foreground">
          No accounts yet. Go to Accounts to add one.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">Accounts</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {accounts.map((account, i) => {
          const Icon = iconMap[account.icon] || Wallet;
          const isNegative = account.balance < 0;
          return (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="glass-card-hover p-4 flex items-center gap-3 cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{account.name}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{account.type.replace("_", " ")}</p>
              </div>
              <p className={`text-sm font-semibold font-mono ${isNegative ? "text-destructive" : "text-foreground"}`}>
                {formatCurrency(account.balance, account.currency as Currency)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
