import { toLocalISODate } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "@/components/CategorySelect";
import { useAccounts, useCreateAccount } from "@/hooks/useAccounts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useBudgetAlertCheck } from "@/hooks/useBudgetAlertCheck";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface QuickAddBarProps {
  lastUsedAccountId?: string;
  lastUsedCategory?: string;
  onAdded?: () => void;
  onOpenFull?: () => void;
}

export function QuickAddBar({ lastUsedAccountId, lastUsedCategory, onAdded, onOpenFull }: QuickAddBarProps) {
  const { data: accounts = [] } = useAccounts();
  const createTransaction = useCreateTransaction();
  const createAccount = useCreateAccount();
  const checkBudgetAlert = useBudgetAlertCheck();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(lastUsedCategory || "Food");
  const [expanded, setExpanded] = useState(false);
  const [accountId, setAccountId] = useState(lastUsedAccountId || "");
  const [description, setDescription] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  // Sync defaults when they change
  useEffect(() => {
    if (lastUsedAccountId && !accountId) setAccountId(lastUsedAccountId);
  }, [lastUsedAccountId]);

  useEffect(() => {
    if (lastUsedCategory) setCategory(lastUsedCategory);
  }, [lastUsedCategory]);

  const handleQuickAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter an amount greater than 0", variant: "destructive" });
      return;
    }

    let accId = accountId;
    if (!accId) {
      if (accounts.length > 0) {
        accId = accounts[0].id;
      } else {
        try {
          const newAcc = await createAccount.mutateAsync({ name: "Cash", type: "cash", balance: 0 });
          accId = newAcc.id;
        } catch (err: any) {
          toast({ title: "Error", description: err.message, variant: "destructive" });
          return;
        }
      }
    }

    try {
      const account = accounts.find(a => a.id === accId);
      await createTransaction.mutateAsync({
        account_id: accId,
        type: "expense",
        amount: amt,
        currency: account?.currency || "LKR",
        category,
        description: description || category,
        date: toLocalISODate(new Date()),
      });
      setAmount("");
      setDescription("");
      setExpanded(false);
      toast({ title: "Expense added!" });
      checkBudgetAlert(category, "expense");
      onAdded?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && amount) {
      e.preventDefault();
      handleQuickAdd();
    }
  };

  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          ref={amountRef}
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Amount"
          className="bg-secondary flex-1 text-base"
          min="0.01"
          step="0.01"
        />
        <CategorySelect
          value={category}
          onValueChange={setCategory}
          kind="expense"
          compact
        />
        <Button
          size="sm"
          onClick={handleQuickAdd}
          disabled={!amount || createTransaction.isPending}
          className="shrink-0 h-9 w-9 p-0"
        >
          {createTransaction.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Note (optional)"
            className="bg-secondary flex-1 text-sm"
          />
          {accounts.length > 0 && (
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary w-[120px] text-xs">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-muted-foreground flex items-center gap-0.5 hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "Note & account"}
        </button>
        <button
          type="button"
          onClick={onOpenFull}
          className="text-[11px] text-primary hover:underline"
        >
          Full form →
        </button>
      </div>
    </div>
  );
}
