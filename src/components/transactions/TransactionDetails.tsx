import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Pencil, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, Currency } from "@/lib/data";
import { useAccounts } from "@/hooks/useAccounts";
import type { Transaction } from "@/hooks/useTransactions";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

interface Props {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  );
}

export function TransactionDetails({ transaction: tx, open, onOpenChange, onEdit, onDelete }: Props) {
  const { data: accounts = [] } = useAccounts();
  if (!tx) return null;

  const from = accounts.find((a) => a.id === tx.account_id);
  const to = accounts.find((a) => a.id === tx.to_account_id);
  const fromCur = (from?.currency || tx.currency) as Currency;
  const toCur = (to?.currency || tx.currency) as Currency;

  const isTransfer = tx.type === "transfer";
  const rate = tx.exchange_rate || 1;
  const charge = tx.transfer_charge || 0;
  const received = tx.amount * rate - charge;

  const Icon = tx.type === "income" ? ArrowDownLeft : isTransfer ? ArrowRightLeft : ArrowUpRight;
  const tone =
    tx.type === "income" ? "text-success" : tx.type === "expense" ? "text-destructive" : "text-primary";
  const toneBg =
    tx.type === "income" ? "bg-success/10" : tx.type === "expense" ? "bg-destructive/10" : "bg-primary/10";

  // Net impact per account (matches the balance math applied on save)
  const impacts: { name: string; delta: number; currency: Currency }[] = [];
  if (isTransfer) {
    impacts.push({ name: from?.name || "From account", delta: -tx.amount, currency: fromCur });
    if (to) impacts.push({ name: to.name, delta: received, currency: toCur });
  } else {
    impacts.push({
      name: from?.name || "Account",
      delta: tx.type === "income" ? tx.amount : -tx.amount,
      currency: fromCur,
    });
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Transaction details</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Headline */}
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl ${toneBg} flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 ${tone}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-xl font-semibold font-mono ${tone}`}>
                {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
                {formatCurrency(tx.amount, fromCur)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {tx.date} · <span className="capitalize">{tx.type}</span>
              </p>
            </div>
          </div>

          {/* Direction */}
          <div className="rounded-lg bg-secondary/50 p-3">
            {isTransfer ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 text-left">
                  <p className="text-[10px] tracking-normal text-muted-foreground">From</p>
                  <p className="font-medium truncate">{from?.name || "—"}</p>
                  <p className="text-xs font-mono text-destructive">−{formatCurrency(tx.amount, fromCur)}</p>
                </div>
                <ArrowRightLeft className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 text-right">
                  <p className="text-[10px] tracking-normal text-muted-foreground">To</p>
                  <p className="font-medium truncate">{to?.name || "—"}</p>
                  <p className="text-xs font-mono text-success">+{formatCurrency(received, toCur)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {tx.type === "income" ? "Money in to" : "Money out of"}
                </span>
                <span className="font-medium truncate">{from?.name || "—"}</span>
              </div>
            )}
          </div>

          {/* Facts */}
          <div className="divide-y divide-border">
            {!isTransfer && <Row label="Category" value={tx.category} />}
            {tx.description && <Row label="Description" value={tx.description} />}
            <Row label="Date" value={tx.date} />
            {isTransfer && fromCur !== toCur && (
              <Row label="Exchange rate" value={`1 ${fromCur} = ${rate} ${toCur}`} />
            )}
            {charge > 0 && <Row label="Fee / charge" value={formatCurrency(charge, toCur)} />}
            {isTransfer && <Row label="Received" value={formatCurrency(received, toCur)} />}
          </div>

          {/* Net impact */}
          <div>
            <p className="text-[10px] tracking-normal text-muted-foreground mb-1.5">
              Net impact on balances
            </p>
            <div className="space-y-1.5">
              {impacts.map((imp, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-secondary/40 px-3 py-2">
                  <span className="text-sm truncate">{imp.name}</span>
                  <Badge
                    variant="secondary"
                    className={`font-mono ${imp.delta >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                  >
                    {imp.delta >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(imp.delta), imp.currency)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1 gap-1.5" onClick={() => onEdit(tx)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={() => onDelete(tx)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
