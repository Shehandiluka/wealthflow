import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Loader2, Pencil, Trash2, PiggyBank, ChevronDown, CheckCircle2,
  Pin, Calendar, TrendingUp, TrendingDown, AlertTriangle, Wallet as WalletIcon,
} from "lucide-react";
import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn, toLocalISODate } from "@/lib/utils";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { useAccounts } from "@/hooks/useAccounts";
import {
  useSavingsGoals, useCreateGoal, useUpdateGoal, useDeleteGoal,
  useAddContribution, useGoalContributions, useDeleteContribution,
  computeGoalPace, GOAL_CATEGORIES, SavingsGoal,
} from "@/hooks/useSavingsGoals";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_STYLES: Record<string, { label: string; className: string; icon: typeof TrendingUp }> = {
  complete: { label: "Complete", className: "text-success bg-success/10", icon: CheckCircle2 },
  overdue: { label: "Overdue", className: "text-destructive bg-destructive/10", icon: AlertTriangle },
  behind: { label: "Behind schedule", className: "text-warning bg-warning/10", icon: TrendingDown },
  "on-track": { label: "On track", className: "text-primary bg-primary/10", icon: TrendingUp },
  ahead: { label: "Ahead of schedule", className: "text-success bg-success/10", icon: TrendingUp },
  "open-ended": { label: "No deadline set", className: "text-muted-foreground bg-secondary", icon: Calendar },
};

function categoryLabel(value: string) {
  return GOAL_CATEGORIES.find((c) => c.value === value)?.label || "Other";
}

const SavingsGoalsPage = () => {
  const { data: goals = [], isLoading } = useSavingsGoals();
  const { data: accounts = [] } = useAccounts();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const addContribution = useAddContribution();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [contribGoal, setContribGoal] = useState<SavingsGoal | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Add/edit form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [currency, setCurrency] = useState("LKR");
  const [targetDate, setTargetDate] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  // Contribution form state
  const [contribAmount, setContribAmount] = useState("");
  const [contribAccountId, setContribAccountId] = useState("");
  const [contribDate, setContribDate] = useState(toLocalISODate(new Date()));
  const [contribNote, setContribNote] = useState("");

  const activeGoals = useMemo(() => goals.filter((g) => !g.is_archived), [goals]);
  const archivedGoals = useMemo(() => goals.filter((g) => g.is_archived), [goals]);

  const resetForm = () => {
    setName(""); setCategory("other"); setTargetAmount(""); setCurrentAmount("0");
    setTargetDate(""); setLinkedAccountId(""); setNotes(""); setIsPinned(false);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditGoal(goal);
    setName(goal.name);
    setCategory(goal.category);
    setTargetAmount(String(goal.target_amount));
    setCurrentAmount(String(goal.current_amount));
    setCurrency(goal.currency);
    setTargetDate(goal.target_date || "");
    setLinkedAccountId(goal.linked_account_id || "");
    setNotes(goal.notes || "");
    setIsPinned(goal.is_pinned);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createGoal.mutateAsync({
        name,
        category,
        target_amount: parseFloat(targetAmount) || 0,
        current_amount: parseFloat(currentAmount) || 0,
        currency,
        target_date: targetDate || null,
        linked_account_id: linkedAccountId || null,
        notes: notes || null,
        is_pinned: isPinned,
      } as any);
      setAddOpen(false);
      resetForm();
      toast({ title: "Goal created!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGoal) return;
    try {
      await updateGoal.mutateAsync({
        id: editGoal.id,
        updates: {
          name, category,
          target_amount: parseFloat(targetAmount) || 0,
          current_amount: parseFloat(currentAmount) || 0,
          currency,
          target_date: targetDate || null,
          linked_account_id: linkedAccountId || null,
          notes: notes || null,
          is_pinned: isPinned,
        },
      });
      setEditGoal(null);
      toast({ title: "Goal updated!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = (goal: SavingsGoal) => {
    deleteGoal.mutate(goal.id, {
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const togglePin = (goal: SavingsGoal) => {
    updateGoal.mutate({ id: goal.id, updates: { is_pinned: !goal.is_pinned } });
  };

  const toggleArchive = (goal: SavingsGoal) => {
    updateGoal.mutate(
      { id: goal.id, updates: { is_archived: !goal.is_archived } },
      { onSuccess: () => toast({ title: goal.is_archived ? "Goal restored" : "Goal archived" }) }
    );
  };

  const openContribute = (goal: SavingsGoal) => {
    setContribGoal(goal);
    setContribAmount("");
    setContribDate(toLocalISODate(new Date()));
    setContribNote("");
    const match = accounts.find((a) => a.currency === goal.currency);
    setContribAccountId(match?.id || "");
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    const amt = parseFloat(contribAmount) || 0;
    if (!amt) return;
    try {
      await addContribution.mutateAsync({
        goal_id: contribGoal.id,
        amount: amt,
        account_id: contribAccountId || null,
        date: contribDate,
        note: contribNote || undefined,
      });
      toast({ title: "Contribution added!" });
      setContribGoal(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const goalForm = (isEdit: boolean, onSubmit: (e: React.FormEvent) => Promise<void>, isPending: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5"><Label>Goal Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Land Tax 2027" className="bg-secondary" required /></div>
      <div className="space-y-1.5"><Label>Category</Label>
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>{GOAL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Currency</Label>
        <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(CURRENCY_SYMBOLS).map(([c, s]) => <SelectItem key={c} value={c}>{s} {c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Target Amount</Label><Input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="bg-secondary" required min="0.01" step="0.01" /></div>
      {isEdit && (
        <div className="space-y-1.5"><Label>Already Saved</Label><Input type="number" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} className="bg-secondary" min="0" step="0.01" /></div>
      )}
      <div className="space-y-1.5">
        <Label>Target Date (optional)</Label>
        <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="bg-secondary" />
        <p className="text-[10px] text-muted-foreground">Set this to get a monthly savings target and on-track/behind tracking. Leave blank for an open-ended goal.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Linked Wallet (optional)</Label>
        <Select value={linkedAccountId || "none"} onValueChange={(v) => setLinkedAccountId(v === "none" ? "" : v)}>
          <SelectTrigger className="bg-secondary"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">Just a reference to where you're keeping this money — doesn't have to match every contribution's wallet.</p>
      </div>
      <div className="space-y-1.5"><Label>Notes (optional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-secondary" rows={2} /></div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setIsPinned(!isPinned)}
          className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border",
            isPinned ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>
          <Pin className="h-3 w-3" /> {isPinned ? "Pinned to dashboard" : "Pin to dashboard"}
        </button>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{isEdit ? "Save Changes" : "Create Goal"}</Button>
    </form>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savings Goals</h1>
        <ResponsiveDialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <ResponsiveDialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New Goal</Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="glass-card border-glass-border">
            <ResponsiveDialogHeader><ResponsiveDialogTitle>New Savings Goal</ResponsiveDialogTitle></ResponsiveDialogHeader>
            {goalForm(false, handleAdd, createGoal.isPending)}
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {activeGoals.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <PiggyBank className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No savings goals yet. Set a target — like a tax bill, a vehicle, or an emergency fund — and track your progress toward it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeGoals.map((goal, i) => {
            const pace = computeGoalPace(goal);
            const status = STATUS_STYLES[pace.status];
            const StatusIcon = status.icon;
            const isExpanded = expandedGoal === goal.id;
            return (
              <SwipeToDelete key={goal.id} onDelete={() => handleDelete(goal)} itemLabel="Goal removed">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass-card p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {goal.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                        <p className="font-medium truncate">{goal.name}</p>
                        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5 shrink-0">
                          {categoryLabel(goal.category)}
                        </span>
                      </div>
                      {goal.notes && <p className="text-xs text-muted-foreground mt-0.5">{goal.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap", status.className)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Pin goal" className="h-7 w-7" onClick={() => togglePin(goal)}>
                        <Pin className={cn("h-3.5 w-3.5", goal.is_pinned ? "text-primary" : "text-muted-foreground")} />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Edit goal" className="h-7 w-7" onClick={() => openEdit(goal)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete goal" className="h-7 w-7" onClick={() => handleDelete(goal)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Saved: {formatCurrency(goal.current_amount, goal.currency as Currency)}</span>
                      <span>Target: {formatCurrency(goal.target_amount, goal.currency as Currency)}</span>
                    </div>
                    <Progress value={pace.percentComplete} className="h-2" />
                    <p className="text-[10px] text-muted-foreground text-right">{pace.percentComplete.toFixed(0)}% saved</p>
                  </div>

                  {!pace.isComplete && goal.target_date && (
                    <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target date</span>
                        <span>{new Date(goal.target_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Need to save monthly</span>
                        <span className="font-mono font-semibold text-primary">
                          {formatCurrency(pace.monthlyRequired || 0, goal.currency as Currency)}/mo
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!pace.isComplete && (
                      <Button size="sm" variant="secondary" className="flex-1 gap-1.5" onClick={() => openContribute(goal)}>
                        <Plus className="h-3.5 w-3.5" /> Add Contribution
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}>
                      History <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                    </Button>
                    {pace.isComplete && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toggleArchive(goal)}>
                        Archive
                      </Button>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && <ContributionHistory goalId={goal.id} currency={goal.currency} />}
                  </AnimatePresence>
                </motion.div>
              </SwipeToDelete>
            );
          })}
        </div>
      )}

      {archivedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="w-full flex items-center justify-between gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Archived ({archivedGoals.length})
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showArchived && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showArchived && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
                {archivedGoals.map((goal) => (
                  <div key={goal.id} className="glass-card p-4 flex items-center justify-between gap-3 opacity-70">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(goal.current_amount, goal.currency as Currency)} / {formatCurrency(goal.target_amount, goal.currency as Currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => toggleArchive(goal)}>Restore</Button>
                      <Button variant="ghost" size="icon" aria-label="Delete goal" className="h-7 w-7" onClick={() => handleDelete(goal)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Dialog */}
      <ResponsiveDialog open={!!editGoal} onOpenChange={(v) => !v && setEditGoal(null)}>
        <ResponsiveDialogContent className="glass-card border-glass-border">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>Edit Goal</ResponsiveDialogTitle></ResponsiveDialogHeader>
          {goalForm(true, handleEdit, updateGoal.isPending)}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Contribute Dialog */}
      <ResponsiveDialog open={!!contribGoal} onOpenChange={(v) => !v && setContribGoal(null)}>
        <ResponsiveDialogContent className="glass-card border-glass-border">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>Add to {contribGoal?.name}</ResponsiveDialogTitle></ResponsiveDialogHeader>
          {contribGoal && (
            <form onSubmit={handleContribute} className="space-y-4">
              <div className="space-y-1.5"><Label>Amount ({contribGoal.currency})</Label>
                <Input type="number" value={contribAmount} onChange={e => setContribAmount(e.target.value)} className="bg-secondary" required min="0.01" step="0.01" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><WalletIcon className="h-3.5 w-3.5" /> From Wallet (optional)</Label>
                <Select value={contribAccountId || "none"} onValueChange={(v) => setContribAccountId(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-secondary"><SelectValue placeholder="Don't deduct from a wallet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't deduct from a wallet</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">If selected, this amount is deducted from that wallet's balance.</p>
              </div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={contribDate} onChange={e => setContribDate(e.target.value)} className="bg-secondary" /></div>
              <div className="space-y-1.5"><Label>Note (optional)</Label><Input value={contribNote} onChange={e => setContribNote(e.target.value)} className="bg-secondary" placeholder="e.g. bonus this month" /></div>
              <Button type="submit" className="w-full" disabled={addContribution.isPending}>
                {addContribution.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Contribution
              </Button>
            </form>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
};

function ContributionHistory({ goalId, currency }: { goalId: string; currency: string }) {
  const { data: contributions = [], isLoading } = useGoalContributions(goalId);
  const deleteContribution = useDeleteContribution();
  const { toast } = useToast();

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="border-t border-border pt-3 space-y-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
        ) : contributions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No contributions logged yet.</p>
        ) : (
          contributions.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs py-1">
              <div>
                <span>{new Date(c.date).toLocaleDateString()}</span>
                {c.note && <span className="text-muted-foreground"> · {c.note}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-success">+{formatCurrency(c.amount, currency as Currency)}</span>
                <button
                  onClick={() => deleteContribution.mutate(c, {
                    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                  })}
                  aria-label="Remove contribution"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

export default SavingsGoalsPage;
