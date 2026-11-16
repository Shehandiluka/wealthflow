import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";
import { Debt, computeMonthlyInterest } from "@/hooks/useDebts";
import { formatCurrency, Currency } from "@/lib/data";
import { cn, toLocalISODate } from "@/lib/utils";

interface Props {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PayType = "principal" | "interest" | "both";

export function RecordPaymentDialog({ debt, open, onOpenChange }: Props) {
  const { data: accounts = [] } = useAccounts();
  const createTx = useCreateTransaction();
  const { toast } = useToast();

  const [payType, setPayType] = useState<PayType>("principal");
  const [accountId, setAccountId] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [date, setDate] = useState(toLocalISODate(new Date()));
  const selectedAccount = accounts.find(a => a.id === accountId);

  useEffect(() => {
    if (debt && open) {
      const hasInterest = !!debt.interest_kind && !!debt.interest_value;
      setPayType(hasInterest ? "both" : "principal");
      setPrincipalAmount(String(debt.emi_amount || ""));
      setInterestAmount(hasInterest ? computeMonthlyInterest(debt).toFixed(2) : "");
      setDate(toLocalISODate(new Date()));
      const match = accounts.find(a => a.currency === debt.currency && a.type !== "credit_card");
      // Only default to a same-currency wallet — defaulting to any wallet risked silently
      // debiting the wrong currency's balance by the raw (unconverted) amount.
      setAccountId(match?.id || "");
    }
  }, [debt, open, accounts]);

  if (!debt) return null;

  const principalAmt = payType === "interest" ? 0 : (parseFloat(principalAmount) || 0);
  const interestAmt = payType === "principal" ? 0 : (parseFloat(interestAmount) || 0);
  const totalAmt = principalAmt + interestAmt;
  const isOverpaying = principalAmt > debt.remaining_amount && debt.remaining_amount > 0;
  const hasInterestSetup = !!debt.interest_kind && !!debt.interest_value;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalAmt || !accountId) return;
    try {
      if (principalAmt > 0) {
        await createTx.mutateAsync({
          account_id: accountId,
          type: "expense",
          amount: principalAmt,
          currency: debt.currency,
          category: "Loan Principal",
          description: `Principal payment — ${debt.name}`,
          date,
          debt_id: debt.id,
          is_interest_payment: false,
        } as any);
      }
      if (interestAmt > 0) {
        await createTx.mutateAsync({
          account_id: accountId,
          type: "expense",
          amount: interestAmt,
          currency: debt.currency,
          category: "Loan Interest",
          description: `Interest payment — ${debt.name}`,
          date,
          debt_id: debt.id,
          is_interest_payment: true,
        } as any);
      }
      toast({
        title: "Payment recorded",
        description: principalAmt > 0
          ? `Remaining: ${formatCurrency(Math.max(0, debt.remaining_amount - principalAmt), debt.currency as Currency)}`
          : "Interest paid — remaining loan balance is unchanged.",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Record Payment — {debt.name}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Remaining principal</span><span className="font-mono font-semibold">{formatCurrency(debt.remaining_amount, debt.currency as Currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Monthly EMI</span><span className="font-mono">{formatCurrency(debt.emi_amount, debt.currency as Currency)}</span></div>
            {hasInterestSetup && (
              <div className="flex justify-between"><span className="text-muted-foreground">Est. interest this month</span><span className="font-mono text-warning">{formatCurrency(computeMonthlyInterest(debt), debt.currency as Currency)}</span></div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>What are you paying?</Label>
            <div className="flex gap-2">
              {([
                { v: "principal", label: "Principal" },
                { v: "interest", label: "Interest" },
                { v: "both", label: "Both" },
              ] as const).map(({ v, label }) => (
                <button type="button" key={v} onClick={() => setPayType(v)}
                  className={cn("flex-1 py-2 rounded-sm text-xs border",
                    payType === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {payType === "principal" && "Reduces what you still owe. Doesn't touch interest tracking."}
              {payType === "interest" && "A real cost, but doesn't reduce the loan balance — it's tracked separately as interest paid."}
              {payType === "both" && "Principal and interest recorded as two separate transactions, each handled correctly."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Pay From Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedAccount && selectedAccount.currency !== debt.currency && (
              <p className="text-[10px] text-destructive">
                ⚠ This wallet is in {selectedAccount.currency}, but the payment amount is in {debt.currency} — the raw
                number will be deducted as-is, not converted. Pick a {debt.currency} wallet if you have one, or add one first.
              </p>
            )}
          </div>

          {payType !== "interest" && (
            <div className="space-y-1.5">
              <Label>Principal Amount ({debt.currency})</Label>
              <Input type="number" value={principalAmount} onChange={e => setPrincipalAmount(e.target.value)} className="bg-secondary" min="0.01" step="0.01" required />
              {isOverpaying && (
                <p className="text-[10px] text-warning">
                  ⚠ This is more than the {formatCurrency(debt.remaining_amount, debt.currency as Currency)} remaining —
                  the full amount will still be debited from your wallet, but the loan can only go down to zero.
                </p>
              )}
            </div>
          )}

          {payType !== "principal" && (
            <div className="space-y-1.5">
              <Label>Interest Amount ({debt.currency})</Label>
              <Input type="number" value={interestAmount} onChange={e => setInterestAmount(e.target.value)} className="bg-secondary" min="0.01" step="0.01" required />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary" />
          </div>

          <div className="rounded-lg bg-secondary/50 p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Total from wallet</span>
            <span className="font-mono font-semibold">{formatCurrency(totalAmt, debt.currency as Currency)}</span>
          </div>

          <Button type="submit" className="w-full" disabled={createTx.isPending || !totalAmt}>
            {createTx.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record Payment
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
