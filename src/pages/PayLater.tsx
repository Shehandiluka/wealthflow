import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, CheckCircle2, Clock, Store, ChevronDown, ChevronUp, ShoppingCart, Banknote, Trash2, Pencil } from "lucide-react";
import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  usePayLater, useCreatePayLaterTab, useAddPurchase, useAddPayment,
  useMarkTabSettled, useDeletePayLaterTab, useDeletePurchase, useEditPayment, useDeletePayment, PayLaterTab,
} from "@/hooks/usePayLater";
import { useAccounts } from "@/hooks/useAccounts";
import { useToast } from "@/hooks/use-toast";
import { PullToRefreshWrapper } from "@/components/PullToRefreshWrapper";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { CategorySelect } from "@/components/CategorySelect";
import { toLocalISODate } from "@/lib/utils";

const PayLaterPage = () => {
  const { data: tabs = [], isLoading } = usePayLater();
  const { toast } = useToast();
  const [addTabOpen, setAddTabOpen] = useState(false);
  const [showSettled, setShowSettled] = useState(false);

  const activeTabs = tabs.filter(t => !t.is_paid);
  const settledTabs = tabs.filter(t => t.is_paid);
  // Tabs can be in different currencies — group instead of blindly summing raw numbers.
  const owedByCurrency = activeTabs.reduce((map, t) => {
    const totalPurchases = t.items.reduce((a, i) => a + i.amount, 0) || t.amount;
    const totalPayments = t.payments.reduce((a, p) => a + p.amount, 0);
    const owed = Math.max(0, totalPurchases - totalPayments);
    map.set(t.currency, (map.get(t.currency) || 0) + owed);
    return map;
  }, new Map<string, number>());
  const owedEntries = Array.from(owedByCurrency.entries()).filter(([, v]) => v > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PullToRefreshWrapper className="h-full">
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Pay Later</h1>
            <p className="text-sm text-muted-foreground">Track store tabs & IOUs</p>
          </div>
          <AddTabDialog open={addTabOpen} onOpenChange={setAddTabOpen} />
        </div>

        <div className="glass-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-normal">Total Owed</p>
            {owedEntries.length === 0 ? (
              <p className="text-2xl font-bold text-destructive">{formatCurrency(0, "LKR" as Currency)}</p>
            ) : (
              <div className="flex flex-wrap gap-x-3">
                {owedEntries.map(([cur, amt]) => (
                  <p key={cur} className="text-2xl font-bold text-destructive">{formatCurrency(amt, cur as Currency)}</p>
                ))}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{activeTabs.length} active tab{activeTabs.length !== 1 ? "s" : ""}</p>
            <p>{settledTabs.length} settled</p>
          </div>
        </div>

        {activeTabs.length === 0 && settledTabs.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            <Store className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No tabs yet. Open one when you buy on credit!</p>
          </div>
        ) : (
          <>
            {activeTabs.map((tab, i) => (
              <TabCard key={tab.id} tab={tab} index={i} />
            ))}

            {settledTabs.length > 0 && (
              <div>
                <button
                  onClick={() => setShowSettled(!showSettled)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  {showSettled ? "Hide" : "Show"} {settledTabs.length} settled tab{settledTabs.length > 1 ? "s" : ""}
                </button>
                {showSettled && settledTabs.map((tab) => (
                  <TabCard key={tab.id} tab={tab} index={0} settled />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PullToRefreshWrapper>
  );
};

function AddTabDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createTab = useCreatePayLaterTab();
  const { toast } = useToast();
  const [store, setStore] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("LKR");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store.trim()) return;
    try {
      await createTab.mutateAsync({ person_or_store: store.trim(), currency, due_date: dueDate || undefined });
      onOpenChange(false);
      setStore(""); setDueDate("");
      toast({ title: "Tab opened!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Open Tab</Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader><ResponsiveDialogTitle>Open Store Tab</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Store / Person</Label>
            <Input value={store} onChange={e => setStore(e.target.value)} placeholder="e.g. Corner Shop" className="bg-secondary" required />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CURRENCY_SYMBOLS).map(([c, s]) => <SelectItem key={c} value={c}>{s} {c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due Date (optional)</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-secondary" />
          </div>
          <Button type="submit" className="w-full" disabled={createTab.isPending}>
            {createTab.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Open Tab
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function TabCard({ tab, index, settled }: { tab: PayLaterTab; index: number; settled?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const markSettled = useMarkTabSettled();
  const deleteTab = useDeletePayLaterTab();
  const { toast } = useToast();

  const totalPurchases = tab.items.length > 0
    ? tab.items.reduce((s, i) => s + i.amount, 0)
    : tab.amount;
  const totalPayments = tab.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, totalPurchases - totalPayments);
  const isOverdue = tab.due_date && new Date(tab.due_date) < new Date() && !tab.is_paid;

  return (
    <SwipeToDelete onDelete={() => deleteTab.mutate(tab.id)} itemLabel="Tab deleted">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className={`glass-card overflow-hidden ${settled ? "opacity-60" : ""}`}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
        >
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${settled ? "bg-success/10" : "bg-destructive/10"}`}>
            {settled ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Store className="h-4 w-4 text-destructive" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${settled ? "line-through" : ""}`}>{tab.person_or_store}</p>
            <p className="text-xs text-muted-foreground">
              {tab.items.length} purchase{tab.items.length !== 1 ? "s" : ""}
              {tab.payments.length > 0 && <> · {tab.payments.length} payment{tab.payments.length !== 1 ? "s" : ""}</>}
              {tab.due_date && <> · Due {tab.due_date}</>}
            </p>
            {isOverdue && <Badge variant="destructive" className="text-[10px] mt-1">Overdue</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className={`text-sm font-semibold font-mono ${remaining > 0 ? "text-destructive" : "text-success"}`}>
                {formatCurrency(remaining, tab.currency as Currency)}
              </p>
              {totalPayments > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  paid {formatCurrency(totalPayments, tab.currency as Currency)}
                </p>
              )}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {tab.items.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground tracking-normal flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" /> Purchases
                    </p>
                    {tab.items.map(item => (
                      <PurchaseRow key={item.id} item={item} currency={tab.currency} tabId={tab.id} settled={settled} />
                    ))}
                  </div>
                )}

                {tab.payments.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground tracking-normal flex items-center gap-1">
                      <Banknote className="h-3 w-3" /> Payments
                    </p>
                    {tab.payments.map(p => (
                      <PaymentRow key={p.id} payment={p} currency={tab.currency} settled={settled} />
                    ))}
                  </div>
                )}

                {!settled && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <AddPurchaseDialog open={addPurchaseOpen} onOpenChange={setAddPurchaseOpen} tabId={tab.id} />
                    <AddPaymentDialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen} tabId={tab.id} remaining={remaining} currency={tab.currency} personOrStore={tab.person_or_store} />
                    {remaining <= 0 && (
                      <Button
                        size="sm" variant="outline"
                        className="gap-1 text-success border-success/30 hover:bg-success/10"
                        onClick={() => { markSettled.mutate(tab.id); toast({ title: "Tab settled!" }); }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Settled
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </SwipeToDelete>
  );
}

function PurchaseRow({ item, currency, tabId, settled }: { item: any; currency: string; tabId: string; settled?: boolean }) {
  const deletePurchase = useDeletePurchase();
  const { toast } = useToast();

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-destructive/5 group">
      <div>
        <p className="text-xs">{item.description || item.category || "Purchase"}</p>
        <p className="text-[10px] text-muted-foreground">{item.purchased_at}{item.category ? ` · ${item.category}` : ""}</p>
      </div>
      <div className="flex items-center gap-1">
        <p className="text-xs font-mono text-destructive">{formatCurrency(item.amount, currency as Currency)}</p>
        {!settled && (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            onClick={() => { deletePurchase.mutate({ id: item.id, pay_later_id: tabId }); toast({ title: "Removed" }); }}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}

function PaymentRow({ payment, currency, settled }: { payment: any; currency: string; settled?: boolean }) {
  const deletePayment = useDeletePayment();
  const editPayment = useEditPayment();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [note, setNote] = useState(payment.note || "");
  const [date, setDate] = useState(payment.paid_at || "");

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt) return;
    try {
      await editPayment.mutateAsync({ id: payment.id, amount: amt, note, paid_at: date, old_amount: payment.amount });
      setEditing(false);
      toast({ title: "Payment updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (editing) {
    return (
      <div className="py-2 px-2 rounded bg-success/5 space-y-2">
        <div className="flex gap-2">
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-secondary h-7 text-xs" min="0.01" step="0.01" />
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note" className="bg-secondary h-7 text-xs" />
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary h-7 text-xs" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={editPayment.isPending}>
            {editPayment.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-success/5 group">
      <div>
        <p className="text-xs">{payment.note || "Payment"}</p>
        <p className="text-[10px] text-muted-foreground">{payment.paid_at}</p>
      </div>
      <div className="flex items-center gap-1">
        <p className="text-xs font-mono text-success">-{formatCurrency(payment.amount, currency as Currency)}</p>
        {!settled && (
          <>
            <button
              className="p-1 rounded hover:bg-secondary"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
            </button>
            <button
              className="p-1 rounded hover:bg-secondary"
              onClick={() => { deletePayment.mutate({ id: payment.id, pay_later_id: payment.pay_later_id, amount: payment.amount }); toast({ title: "Payment deleted" }); }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
function AddPurchaseDialog({ open, onOpenChange, tabId }: { open: boolean; onOpenChange: (v: boolean) => void; tabId: string }) {
  const addPurchase = useAddPurchase();
  const { toast } = useToast();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [date, setDate] = useState(toLocalISODate(new Date()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || !date) return;
    try {
      await addPurchase.mutateAsync({ pay_later_id: tabId, description: desc.trim(), amount: amt, category, purchased_at: date });
      onOpenChange(false);
      setDesc(""); setAmount(""); setCategory("Other"); setDate(toLocalISODate(new Date()));
      toast({ title: "Purchase added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Add Purchase</Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Purchase</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="bg-secondary" required min="0.01" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategorySelect value={category} onValueChange={setCategory} kind="expense" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Groceries, rice, etc." className="bg-secondary" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary" required />
          </div>
          <Button type="submit" className="w-full" disabled={addPurchase.isPending}>
            {addPurchase.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function AddPaymentDialog({ open, onOpenChange, tabId, remaining, currency, personOrStore }: { open: boolean; onOpenChange: (v: boolean) => void; tabId: string; remaining: number; currency: string; personOrStore: string }) {
  const addPayment = useAddPayment();
  const { data: accounts = [] } = useAccounts();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const matchingAccounts = accounts.filter(acc => acc.currency === currency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt) return;
    try {
      await addPayment.mutateAsync({
        pay_later_id: tabId,
        amount: amt,
        note: note.trim(),
        paid_at: date || undefined,
        account_id: accountId || undefined,
        currency,
        person_or_store: personOrStore,
      });
      onOpenChange(false);
      setAmount(""); setNote(""); setDate(""); setAccountId("");
      toast({ title: "Payment recorded" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-success border-success/30 hover:bg-success/10">
          <Banknote className="h-3.5 w-3.5" /> Make Payment
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader><ResponsiveDialogTitle>Record Payment</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <p className="text-xs text-muted-foreground">Remaining: {formatCurrency(remaining, currency as Currency)}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={remaining.toFixed(2)} className="bg-secondary" required min="0.01" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label>Debit from Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary">
                <SelectValue placeholder="Select account (optional)" />
              </SelectTrigger>
              <SelectContent>
                {matchingAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance, acc.currency as Currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {matchingAccounts.length === 0 ? (
              <p className="text-[10px] text-warning">
                No {currency} wallet yet — add one from Accounts to link a payment, or leave this unselected to just record the payment without touching a wallet balance.
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">If selected, an expense transaction will be created automatically.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Salary payment, partial, etc." className="bg-secondary" />
          </div>
          <div className="space-y-1.5">
            <Label>Date (optional)</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary" />
          </div>
          <Button type="submit" className="w-full" disabled={addPayment.isPending}>
            {addPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Record Payment
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default PayLaterPage;
