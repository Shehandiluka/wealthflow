import { toLocalISODate } from "@/lib/utils";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CategorySelect } from "@/components/CategorySelect";
import { Transaction, useUpdateTransaction } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useDebts } from "@/hooks/useDebts";
import { useTrips } from "@/hooks/useTrips";
import { useToast } from "@/hooks/use-toast";
import { useServiceChargeExpense } from "@/hooks/useServiceChargeExpense";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTransactionDialog({ transaction, open, onOpenChange }: EditTransactionDialogProps) {
  const { data: accounts = [] } = useAccounts();
  const { data: trips = [] } = useTrips();
  const { data: debts = [] } = useDebts();
  const updateTransaction = useUpdateTransaction();
  const { toast } = useToast();
  const { recordServiceCharge } = useServiceChargeExpense();

  const [txType, setTxType] = useState(transaction?.type || "expense");
  const [txAmount, setTxAmount] = useState(String(transaction?.amount || ""));
  const [txCategory, setTxCategory] = useState(transaction?.category || "Food");
  const [txDescription, setTxDescription] = useState(transaction?.description || "");
  const [txAccountId, setTxAccountId] = useState(transaction?.account_id || "");
  const [txToAccountId, setTxToAccountId] = useState(transaction?.to_account_id || "");
  const [txDate, setTxDate] = useState(transaction?.date || toLocalISODate(new Date()));
  const [txTripId, setTxTripId] = useState(transaction?.trip_id || "none");
  const [txExchangeRate, setTxExchangeRate] = useState(String((transaction as any)?.exchange_rate || ""));
  const [txTransferCharge, setTxTransferCharge] = useState(String((transaction as any)?.transfer_charge || ""));
  const [txDebtId, setTxDebtId] = useState<string>(transaction?.debt_id || "none");
  const [txIsInterestPayment, setTxIsInterestPayment] = useState<boolean>((transaction as any)?.is_interest_payment || false);
  const [txReceivedAmount, setTxReceivedAmount] = useState("");
  const [crossCurrencyMode, setCrossCurrencyMode] = useState<"rate" | "amount">("amount");
  const [hasServiceCharge, setHasServiceCharge] = useState(false);
  const [serviceChargeAmount, setServiceChargeAmount] = useState("");

  // Reset form state whenever the dialog opens or the transaction changes
  const [lastSyncKey, setLastSyncKey] = useState<string | null>(null);
  const syncKey = transaction ? `${transaction.id}-${transaction.amount}-${transaction.type}-${transaction.account_id}-${transaction.exchange_rate}-${transaction.transfer_charge}` : null;
  if (syncKey && syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setTxType(transaction!.type);
    setTxAmount(String(transaction!.amount));
    setTxCategory(transaction!.category);
    setTxDescription(transaction!.description);
    setTxAccountId(transaction!.account_id);
    setTxToAccountId(transaction!.to_account_id || "");
    setTxDate(transaction!.date);
    setTxTripId(transaction!.trip_id || "none");
    setTxExchangeRate(String(transaction!.exchange_rate || ""));
    setTxTransferCharge(String(transaction!.transfer_charge || ""));
    setTxDebtId((transaction as any)!.debt_id || "none");
    setTxIsInterestPayment((transaction as any)!.is_interest_payment || false);
    const existingRate = transaction!.exchange_rate || 1;
    const existingCharge = transaction!.transfer_charge || 0;
    setTxReceivedAmount(String(transaction!.amount * existingRate - existingCharge));
    setCrossCurrencyMode("amount");
    setHasServiceCharge(false);
    setServiceChargeAmount("");
  }

  const fromAccount = accounts.find(a => a.id === txAccountId);
  const toAccount = accounts.find(a => a.id === txToAccountId);
  const isCrossCurrency = txType === "transfer" && fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter an amount greater than 0", variant: "destructive" });
      return;
    }

    try {
      await updateTransaction.mutateAsync({
        original: transaction,
        updates: {
          type: txType,
          amount,
          category: txType === "transfer" ? "Transfer" : txCategory,
          description: txDescription || txCategory,
          account_id: txAccountId,
          to_account_id: txType === "transfer" ? txToAccountId : null,
          date: txDate,
          trip_id: (txTripId && txTripId !== "none") ? txTripId : null,
          exchange_rate: txType === "transfer" ? (
            crossCurrencyMode === "amount" && isCrossCurrency
              ? parseFloat((amount > 0 ? ((parseFloat(txReceivedAmount) || 0) + (parseFloat(txTransferCharge) || 0)) / amount : 1).toFixed(6))
              : (parseFloat(txExchangeRate) || 1)
          ) : null,
          transfer_charge: txType === "transfer" ? (parseFloat(txTransferCharge) || 0) : 0,
          debt_id: txType === "expense" && txDebtId !== "none" ? txDebtId : null,
          is_interest_payment: txType === "expense" && txDebtId !== "none" ? txIsInterestPayment : false,
        } as any,
      });

      // Record service charge as expense if checked
      if (hasServiceCharge && parseFloat(serviceChargeAmount) > 0 && txAccountId) {
        const acct = accounts.find(a => a.id === txAccountId);
        await recordServiceCharge({
          amount: parseFloat(serviceChargeAmount),
          currency: acct?.currency || "LKR",
          accountId: txAccountId,
          date: txDate,
          description: `Service charge — ${txType === "transfer" ? "Transfer" : txDescription || txCategory}`,
        });
      }

      onOpenChange(false);
      toast({ title: "Transaction updated!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader><ResponsiveDialogTitle>Edit Transaction</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={txType} onValueChange={setTxType}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{txType === "transfer" ? "From Account" : "Account"}</Label>
            <Select value={txAccountId} onValueChange={setTxAccountId}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {txType === "transfer" && (
            <div className="space-y-1.5">
              <Label>To Account</Label>
              <Select value={txToAccountId} onValueChange={setTxToAccountId}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.id !== txAccountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isCrossCurrency && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Converting {fromAccount.currency} → {toAccount.currency}
                </p>
                <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
                  <button type="button" onClick={() => setCrossCurrencyMode("amount")} className={`px-2.5 py-1 transition-colors ${crossCurrencyMode === "amount" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Amount</button>
                  <button type="button" onClick={() => setCrossCurrencyMode("rate")} className={`px-2.5 py-1 transition-colors ${crossCurrencyMode === "rate" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Rate</button>
                </div>
              </div>
              {crossCurrencyMode === "amount" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Amount Received ({toAccount.currency})</Label>
                    <Input type="number" value={txReceivedAmount} onChange={e => setTxReceivedAmount(e.target.value)} placeholder="0.00" className="bg-secondary" step="0.01" min="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transfer Charge ({toAccount.currency})</Label>
                    <Input type="number" value={txTransferCharge} onChange={e => setTxTransferCharge(e.target.value)} placeholder="0.00" className="bg-secondary" step="0.01" min="0" />
                  </div>
                  {txAmount && txReceivedAmount && (
                    <p className="text-xs text-muted-foreground">
                      Effective rate: <span className="font-semibold text-foreground">
                        1 {fromAccount.currency} = {(parseFloat(txAmount) > 0 ? ((parseFloat(txReceivedAmount) + (parseFloat(txTransferCharge) || 0)) / parseFloat(txAmount)).toFixed(4) : "—")} {toAccount.currency}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Exchange Rate (1 {fromAccount.currency} = ? {toAccount.currency})</Label>
                    <Input type="number" value={txExchangeRate} onChange={e => setTxExchangeRate(e.target.value)} placeholder="e.g. 97.87" className="bg-secondary" step="0.01" min="0.0001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transfer Charge ({toAccount.currency})</Label>
                    <Input type="number" value={txTransferCharge} onChange={e => setTxTransferCharge(e.target.value)} placeholder="0.00" className="bg-secondary" step="0.01" min="0" />
                  </div>
                  {txAmount && txExchangeRate && (
                    <p className="text-xs text-muted-foreground">
                      Recipient gets: <span className="font-semibold text-foreground">
                        {((parseFloat(txAmount) || 0) * (parseFloat(txExchangeRate) || 1) - (parseFloat(txTransferCharge) || 0)).toFixed(2)} {toAccount.currency}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" className="bg-secondary" required min="0.01" step="0.01" />
          </div>
          {txType !== "transfer" && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <CategorySelect value={txCategory} onValueChange={setTxCategory} kind={txType === "income" ? "income" : "expense"} />
            </div>
          )}
          {txType === "expense" && debts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Pay toward debt (optional)</Label>
              <Select value={txDebtId} onValueChange={setTxDebtId}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {debts.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {d.remaining_amount.toFixed(2)} {d.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {txDebtId !== "none" && (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="edit-interest-payment"
                      checked={txIsInterestPayment}
                      onCheckedChange={(v) => setTxIsInterestPayment(v === true)}
                    />
                    <Label htmlFor="edit-interest-payment" className="text-sm cursor-pointer">
                      This is an interest payment
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {txIsInterestPayment
                      ? "Won't reduce the loan's remaining balance — counts toward interest paid instead."
                      : "Deducts from the debt's remaining balance (principal payment)."}
                  </p>
                </>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="What's this for?" className="bg-secondary" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} className="bg-secondary" />
          </div>
          {trips.length > 0 && (
            <div className="space-y-1.5">
              <Label>Trip (optional)</Label>
              <Select value={txTripId} onValueChange={setTxTripId}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="No trip" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No trip</SelectItem>
                  {trips.filter(t => t.is_active).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {txAccountId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-service-charge"
                  checked={hasServiceCharge}
                  onCheckedChange={(v) => setHasServiceCharge(v === true)}
                />
                <Label htmlFor="edit-service-charge" className="text-sm cursor-pointer">
                  Service charge applies
                </Label>
              </div>
              {hasServiceCharge && (
                <div className="space-y-1.5 pl-6">
                  <Label>Charge Amount</Label>
                  <Input
                    type="number"
                    value={serviceChargeAmount}
                    onChange={e => setServiceChargeAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-secondary"
                    step="0.01"
                    min="0.01"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Will be recorded as an expense under Utilities &gt; Bank Transfer
                  </p>
                </div>
              )}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={updateTransaction.isPending}>
            {updateTransaction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
