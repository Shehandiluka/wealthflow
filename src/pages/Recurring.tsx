import { toLocalISODate } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CategorySelect } from "@/components/CategorySelect";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { Plus, Loader2, RefreshCw, Calendar, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, Currency } from "@/lib/data";
import {
  useRecurringTransactions, useCreateRecurring, useToggleRecurring, useDeleteRecurring,
} from "@/hooks/useRecurring";
import { useAccounts } from "@/hooks/useAccounts";
import { useToast } from "@/hooks/use-toast";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";


const frequencies = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const RecurringPage = () => {
  const { data: items = [], isLoading } = useRecurringTransactions();
  const { data: accounts = [] } = useAccounts();
  const createRecurring = useCreateRecurring();
  const toggleRecurring = useToggleRecurring();
  const deleteRecurring = useDeleteRecurring();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-recurring");
      if (error) throw error;
      const count = (data as any)?.processed ?? 0;
      toast({
        title: count > 0 ? `Processed ${count} due item${count === 1 ? "" : "s"}` : "Nothing due",
        description: count > 0 ? "Balances and transactions updated." : "No recurring items are due today or overdue.",
      });
      qc.invalidateQueries({ queryKey: ["recurring-transactions"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const [txType, setTxType] = useState("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Salary");
  const [txDescription, setTxDescription] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txToAccountId, setTxToAccountId] = useState("");
  const [txFrequency, setTxFrequency] = useState("monthly");
  const [txNextDue, setTxNextDue] = useState(toLocalISODate(new Date()));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (!amount || !txAccountId) return;
    try {
      const account = accounts.find((a) => a.id === txAccountId);
      await createRecurring.mutateAsync({
        account_id: txAccountId,
        to_account_id: txType === "transfer" ? txToAccountId : null,
        type: txType,
        amount,
        currency: account?.currency || "LKR",
        category: txType === "transfer" ? "Transfer" : txCategory,
        description: txDescription || txCategory,
        frequency: txFrequency,
        next_due: txNextDue,
      });
      setAddOpen(false);
      setTxAmount("");
      setTxDescription("");
      toast({ title: "Recurring transaction added!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Recurring</h1>
          <p className="text-sm text-muted-foreground">Auto-logged subscriptions & salary</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleProcessNow} disabled={processing}>
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Process Due Now
          </Button>
          <ResponsiveDialog open={addOpen} onOpenChange={setAddOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="glass-card border-glass-border">
            <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Recurring Transaction</ResponsiveDialogTitle></ResponsiveDialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <ToggleSelect
                  value={txType}
                  onValueChange={setTxType}
                  options={[
                    { value: "expense", label: "Expense" },
                    { value: "income", label: "Income" },
                    { value: "transfer", label: "Transfer" },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{txType === "transfer" ? "From Account" : "Account"}</Label>
                <Select value={txAccountId} onValueChange={setTxAccountId}>
                  <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {txType === "transfer" && (
                <div className="space-y-1.5">
                  <Label>To Account</Label>
                  <Select value={txToAccountId} onValueChange={setTxToAccountId}>
                    <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => a.id !== txAccountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0.00" className="bg-secondary" required min="0.01" step="0.01" />
              </div>
              {txType !== "transfer" && (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <CategorySelect value={txCategory} onValueChange={setTxCategory} kind={txType === "income" ? "income" : "expense"} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={txDescription} onChange={(e) => setTxDescription(e.target.value)} placeholder="e.g. Netflix subscription" className="bg-secondary" />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <ToggleSelect
                  value={txFrequency}
                  onValueChange={setTxFrequency}
                  options={frequencies}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Next Due Date</Label>
                <Input type="date" value={txNextDue} onChange={(e) => setTxNextDue(e.target.value)} className="bg-secondary" />
              </div>
              <Button type="submit" className="w-full" disabled={createRecurring.isPending}>
                {createRecurring.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Recurring
              </Button>
            </form>
          </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No recurring transactions yet.</p>
          <p className="text-xs mt-1">Add salary, subscriptions, or bills to auto-log them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <SwipeToDelete
              key={item.id}
              className="glass-card rounded-xl"
              itemLabel="Recurring transaction deleted"
              onDelete={() => deleteRecurring.mutate(item.id)}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      {!item.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Paused</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground capitalize">{item.frequency}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{item.category}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {item.next_due}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className={`text-sm font-semibold font-mono ${item.type === "income" ? "text-success" : item.type === "expense" ? "text-destructive" : "text-foreground"}`}>
                      {item.type === "income" ? "+" : item.type === "expense" ? "-" : ""}
                      {formatCurrency(Number(item.amount), item.currency as Currency)}
                    </p>
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={(checked) => toggleRecurring.mutate({ id: item.id, is_active: checked })}
                    />
                  </div>
                </div>
              </motion.div>
            </SwipeToDelete>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringPage;
