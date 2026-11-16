import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Loader2, Pencil, Trash2, CreditCard, ChevronDown, CheckCircle2, Percent } from "lucide-react";
import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { useDebts, useCreateDebt, useUpdateDebt, useDeleteDebt, Debt, computeMonthlyInterest } from "@/hooks/useDebts";
import { useCreateRecurring } from "@/hooks/useRecurring";
import { useAccounts } from "@/hooks/useAccounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn, toLocalISODate } from "@/lib/utils";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { RecordPaymentDialog } from "@/components/debts/RecordPaymentDialog";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** Next occurrence of a "day of month" due date, and how many days away it is. Clamped to 28 so it's always valid regardless of month length. */
function getNextDueInfo(dueDay: number): { date: Date; daysUntil: number } {
  const now = new Date();
  const day = Math.min(Math.max(dueDay || 1, 1), 28);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let due = new Date(now.getFullYear(), now.getMonth(), day);
  if (due < today) due = new Date(now.getFullYear(), now.getMonth() + 1, day);
  const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
  return { date: due, daysUntil };
}

function dueBadge(daysUntil: number): { label: string; className: string } {
  if (daysUntil === 0) return { label: "Due today", className: "text-destructive bg-destructive/10" };
  if (daysUntil === 1) return { label: "Due tomorrow", className: "text-warning bg-warning/10" };
  if (daysUntil <= 5) return { label: `Due in ${daysUntil} days`, className: "text-warning bg-warning/10" };
  return { label: `Due in ${daysUntil} days`, className: "text-muted-foreground bg-secondary" };
}

/** This month's interest owed, given the debt's interest settings and current outstanding balance. */

const DebtsPage = () => {
  const { data: debts = [], isLoading } = useDebts();
  const { data: accounts = [] } = useAccounts();
  const createDebt = useCreateDebt();
  const createRecurring = useCreateRecurring();
  const updateDebt = useUpdateDebt();
  const deleteDebt = useDeleteDebt();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  // Add form state
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [remaining, setRemaining] = useState("");
  const [emi, setEmi] = useState("");
  const [dueDate, setDueDate] = useState("1");
  const [currency, setCurrency] = useState("LKR");
  const [description, setDescription] = useState("");
  const [interestKind, setInterestKind] = useState<"none" | "percentage" | "fixed">("none");
  const [interestValue, setInterestValue] = useState("");

  // Edit form state
  const [eName, setEName] = useState("");
  const [eTotal, setETotal] = useState("");
  const [eRemaining, setERemaining] = useState("");
  const [eEmi, setEEmi] = useState("");
  const [eDueDate, setEDueDate] = useState("1");
  const [eCurrency, setECurrency] = useState("LKR");
  const [eDescription, setEDescription] = useState("");
  const [eInterestKind, setEInterestKind] = useState<"none" | "percentage" | "fixed">("none");
  const [eInterestValue, setEInterestValue] = useState("");

  // A loan with nothing left owing is settled — it shouldn't clutter the active list
  // or count toward outstanding totals, but it also shouldn't disappear entirely.
  const activeDebts = useMemo(
    () =>
      debts
        .filter((d) => d.remaining_amount > 0)
        .map((d) => ({ debt: d, ...getNextDueInfo(d.due_date) }))
        .sort((a, b) => a.daysUntil - b.daysUntil),
    [debts]
  );
  const settledDebts = useMemo(() => debts.filter((d) => d.remaining_amount <= 0), [debts]);

  const totalDebt = activeDebts.reduce((s, { debt }) => s + debt.remaining_amount, 0);
  const totalEmi = activeDebts.reduce((s, { debt }) => s + debt.emi_amount, 0);
  const totalMonthlyInterest = activeDebts.reduce((s, { debt }) => s + computeMonthlyInterest(debt), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const emiAmount = parseFloat(emi) || 0;
      const dueDay = parseInt(dueDate) || 1;
      const created = await createDebt.mutateAsync({
        name,
        total_amount: parseFloat(total) || 0,
        remaining_amount: parseFloat(remaining) || 0,
        emi_amount: emiAmount,
        due_date: dueDay,
        currency,
        description: description || null,
        interest_kind: interestKind === "none" ? null : interestKind,
        interest_value: interestKind === "none" ? null : parseFloat(interestValue) || 0,
        interest_period: interestKind === "none" ? null : "monthly",
      } as any);

      // Auto-create monthly recurring EMI when an EMI amount is set (principal only —
      // interest is recorded separately each month from the debt card's Pay button)
      if (emiAmount > 0) {
        const match = accounts.find(a => a.currency === currency && a.type !== "credit_card") || accounts[0];
        if (match) {
          const now = new Date();
          let next = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, 28));
          if (next < now) next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dueDay, 28));
          try {
            await createRecurring.mutateAsync({
              account_id: match.id,
              to_account_id: null,
              type: "expense",
              amount: emiAmount,
              currency,
              category: "Loan/EMI",
              description: `EMI — ${name}`,
              frequency: "monthly",
              next_due: toLocalISODate(next),
              debt_id: (created as any).id,
            } as any);
          } catch (e) { /* non-blocking */ }
        }
      }

      setAddOpen(false);
      setName(""); setTotal(""); setRemaining(""); setEmi(""); setDescription("");
      setInterestKind("none"); setInterestValue("");
      toast({ title: "Debt added!", description: emiAmount > 0 ? "Monthly EMI scheduled automatically." : undefined });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openPay = (debt: Debt) => {
    setPayDebt(debt);
    setPayOpen(true);
  };

  const openEdit = (debt: Debt) => {
    setEditDebt(debt);
    setEName(debt.name);
    setETotal(String(debt.total_amount));
    setERemaining(String(debt.remaining_amount));
    setEEmi(String(debt.emi_amount));
    setEDueDate(String(debt.due_date));
    setECurrency(debt.currency);
    setEDescription(debt.description || "");
    setEInterestKind((debt.interest_kind as "percentage" | "fixed" | null) || "none");
    setEInterestValue(debt.interest_value ? String(debt.interest_value) : "");
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDebt) return;
    try {
      await updateDebt.mutateAsync({
        id: editDebt.id,
        updates: {
          name: eName,
          total_amount: parseFloat(eTotal) || 0,
          remaining_amount: parseFloat(eRemaining) || 0,
          emi_amount: parseFloat(eEmi) || 0,
          due_date: parseInt(eDueDate) || 1,
          currency: eCurrency,
          description: eDescription || null,
          interest_kind: eInterestKind === "none" ? null : eInterestKind,
          interest_value: eInterestKind === "none" ? null : parseFloat(eInterestValue) || 0,
          interest_period: eInterestKind === "none" ? null : "monthly",
        } as any,
      });
      setEditOpen(false);
      toast({ title: "Debt updated!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = (debt: Debt) => {
    deleteDebt.mutate(debt.id, {
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const debtForm = (
    isEdit: boolean,
    onSubmit: (e: React.FormEvent) => Promise<void>,
    values: { name: string; total: string; remaining: string; emi: string; dueDate: string; currency: string; description: string; interestKind: "none" | "percentage" | "fixed"; interestValue: string },
    setters: { setName: (v: string) => void; setTotal: (v: string) => void; setRemaining: (v: string) => void; setEmi: (v: string) => void; setDueDate: (v: string) => void; setCurrency: (v: string) => void; setDescription: (v: string) => void; setInterestKind: (v: "none" | "percentage" | "fixed") => void; setInterestValue: (v: string) => void },
    isPending: boolean,
  ) => {
    const remainingNum = parseFloat(values.remaining) || 0;
    const previewInterest = values.interestKind === "none" ? 0
      : values.interestKind === "percentage" ? (remainingNum * (parseFloat(values.interestValue) || 0)) / 100
      : parseFloat(values.interestValue) || 0;
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5"><Label>Name</Label><Input value={values.name} onChange={e => setters.setName(e.target.value)} placeholder="e.g. Home Loan" className="bg-secondary" required /></div>
        <div className="space-y-1.5"><Label>Description (optional)</Label><Input value={values.description} onChange={e => setters.setDescription(e.target.value)} placeholder="e.g. borrowed from Priyani" className="bg-secondary" /></div>
        <div className="space-y-1.5"><Label>Currency</Label>
          <Select value={values.currency} onValueChange={setters.setCurrency}><SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CURRENCY_SYMBOLS).map(([c, s]) => <SelectItem key={c} value={c}>{s} {c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Total Amount</Label><Input type="number" value={values.total} onChange={e => setters.setTotal(e.target.value)} className="bg-secondary" required min="0" step="0.01" /></div>
        <div className="space-y-1.5"><Label>Remaining Amount</Label><Input type="number" value={values.remaining} onChange={e => setters.setRemaining(e.target.value)} className="bg-secondary" required min="0" step="0.01" /></div>
        <div className="space-y-1.5"><Label>Monthly EMI (principal)</Label><Input type="number" value={values.emi} onChange={e => setters.setEmi(e.target.value)} className="bg-secondary" min="0" step="0.01" /></div>
        <div className="space-y-1.5"><Label>Due Date (Day of Month)</Label><Input type="number" value={values.dueDate} onChange={e => setters.setDueDate(e.target.value)} className="bg-secondary" min="1" max="31" /></div>

        <div className="space-y-1.5 pt-2 border-t border-border">
          <Label className="flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Monthly Interest</Label>
          <div className="flex gap-2">
            {(["none", "percentage", "fixed"] as const).map((k) => (
              <button type="button" key={k} onClick={() => setters.setInterestKind(k)}
                className={cn("flex-1 py-2 rounded-sm text-xs capitalize border",
                  values.interestKind === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>
                {k === "none" ? "No interest" : k === "percentage" ? "% of balance" : "Fixed amount"}
              </button>
            ))}
          </div>
          {values.interestKind !== "none" && (
            <>
              <Input
                type="number" min="0" step="0.01"
                placeholder={values.interestKind === "percentage" ? "e.g. 15 (means 15% per month)" : `e.g. 5000 (${values.currency}/month)`}
                value={values.interestValue} onChange={e => setters.setInterestValue(e.target.value)}
                className="bg-secondary mt-1"
              />
              <p className="text-[11px] text-muted-foreground">
                This month's interest ≈ {formatCurrency(previewInterest, values.currency as Currency)}
                {values.interestKind === "percentage" && " (recalculated each month from the remaining balance)"}
              </p>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">
            Interest is paid separately from the principal EMI — it's a real cost, but it doesn't
            reduce what you still owe. Use the "Pay" button on the debt card each month for this.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEdit ? "Save Changes" : "Add Debt"}</Button>
      </form>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Debts & EMI</h1>
        <ResponsiveDialog open={addOpen} onOpenChange={setAddOpen}>
          <ResponsiveDialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Debt</Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="glass-card border-glass-border">
            <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Debt</ResponsiveDialogTitle></ResponsiveDialogHeader>
            {debtForm(false, handleAdd,
              { name, total, remaining, emi, dueDate, currency, description, interestKind, interestValue },
              { setName, setTotal, setRemaining, setEmi, setDueDate, setCurrency, setDescription, setInterestKind, setInterestValue },
              createDebt.isPending)}
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
          <p className="text-2xl font-bold font-mono text-destructive">{formatCurrency(totalDebt)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Monthly EMI (principal)</p>
          <p className="text-2xl font-bold font-mono text-warning">{formatCurrency(totalEmi)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Monthly Interest (est.)</p>
          <p className="text-2xl font-bold font-mono text-warning">{formatCurrency(totalMonthlyInterest)}</p>
        </motion.div>
      </div>

      {debts.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground"><p>No debts tracked. Add a loan to get started.</p></div>
      ) : (
        <>
          {activeDebts.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
              <p>All your tracked loans are fully paid off. Nice.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeDebts.map(({ debt, daysUntil }, i) => {
                const paid = debt.total_amount - debt.remaining_amount;
                const progress = debt.total_amount > 0 ? (paid / debt.total_amount) * 100 : 0;
                const badge = dueBadge(daysUntil);
                const monthlyInterest = computeMonthlyInterest(debt);
                return (
                  <SwipeToDelete key={debt.id} onDelete={() => handleDelete(debt)} itemLabel="Debt removed">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium">{debt.name}</p>
                          {debt.description && <p className="text-xs text-muted-foreground">{debt.description}</p>}
                          <p className="text-xs text-muted-foreground">
                            EMI: <span className="font-mono">{formatCurrency(debt.emi_amount, debt.currency as Currency)}</span>/month
                            {monthlyInterest > 0 && (
                              <> · Interest: <span className="font-mono text-warning">{formatCurrency(monthlyInterest, debt.currency as Currency)}</span>/month
                              {debt.interest_kind === "percentage" && ` (${debt.interest_value}%)`}</>
                            )}
                          </p>
                          {debt.interest_paid > 0 && (
                            <p className="text-[11px] text-muted-foreground">Interest paid to date: {formatCurrency(debt.interest_paid, debt.currency as Currency)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn("flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium", badge.className)}>
                            <Calendar className="h-3.5 w-3.5" />
                            {badge.label} (the {debt.due_date}th)
                          </div>
                          <Button variant="ghost" size="icon" aria-label="Edit debt" className="h-7 w-7" onClick={() => openEdit(debt)}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete debt" className="h-7 w-7" onClick={() => handleDelete(debt)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Paid: {formatCurrency(paid, debt.currency as Currency)}</span>
                          <span>Remaining: {formatCurrency(debt.remaining_amount, debt.currency as Currency)}</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-[10px] text-muted-foreground text-right">{progress.toFixed(0)}% paid</p>
                      </div>
                      <Button size="sm" variant="secondary" className="w-full gap-1.5" onClick={() => openPay(debt)}>
                        <CreditCard className="h-3.5 w-3.5" /> Record Payment
                      </Button>
                    </motion.div>
                  </SwipeToDelete>
                );
              })}
            </div>
          )}

          {settledDebts.length > 0 && (
            <div>
              <button
                onClick={() => setShowSettled((s) => !s)}
                className="w-full flex items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Paid off ({settledDebts.length})
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showSettled && "rotate-180")} />
              </button>
              <AnimatePresence>
                {showSettled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3"
                  >
                    {settledDebts.map((debt) => (
                      <SwipeToDelete key={debt.id} onDelete={() => handleDelete(debt)} itemLabel="Debt removed">
                        <div className="glass-card p-4 flex items-center justify-between gap-3 opacity-70">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{debt.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Fully paid · {formatCurrency(debt.total_amount, debt.currency as Currency)} total
                              {debt.interest_paid > 0 && ` · ${formatCurrency(debt.interest_paid, debt.currency as Currency)} interest paid`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-success font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                            </span>
                            <Button variant="ghost" size="icon" aria-label="Delete debt" className="h-7 w-7" onClick={() => handleDelete(debt)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </SwipeToDelete>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <RecordPaymentDialog debt={payDebt} open={payOpen} onOpenChange={setPayOpen} />

      {/* Edit Dialog */}
      <ResponsiveDialog open={editOpen} onOpenChange={setEditOpen}>
        <ResponsiveDialogContent className="glass-card border-glass-border">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>Edit Debt</ResponsiveDialogTitle></ResponsiveDialogHeader>
          {debtForm(true, handleEdit,
            { name: eName, total: eTotal, remaining: eRemaining, emi: eEmi, dueDate: eDueDate, currency: eCurrency, description: eDescription, interestKind: eInterestKind, interestValue: eInterestValue },
            { setName: setEName, setTotal: setETotal, setRemaining: setERemaining, setEmi: setEEmi, setDueDate: setEDueDate, setCurrency: setECurrency, setDescription: setEDescription, setInterestKind: setEInterestKind, setInterestValue: setEInterestValue },
            updateDebt.isPending)}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
};

export default DebtsPage;
