import { toLocalISODate } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Gem, Landmark, BarChart3, Plus, Loader2, X, Settings2, History, Trash2 } from "lucide-react";
import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import {
  useInvestments, useCreateInvestment, useDeleteInvestment, useInvestmentTypes, useCreateInvestmentType,
  useDeleteInvestmentType, useAddContribution, useContributions, BUILT_IN_INVESTMENT_TYPES,
  Investment,
} from "@/hooks/useInvestments";
import { useAccounts } from "@/hooks/useAccounts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const typeIcons: Record<string, React.ElementType> = {
  stock: BarChart3,
  gold: Gem,
  fixed_deposit: Landmark,
};

const prettyType = (t: string) => t.replace(/_/g, " ");

function ContributeDialog({ investment, open, onOpenChange }: { investment: Investment | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: accounts = [] } = useAccounts();
  const addContribution = useAddContribution();
  const { data: history = [] } = useContributions(investment?.id);
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [valueChange, setValueChange] = useState("");
  const [accountId, setAccountId] = useState("none");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toLocalISODate(new Date()));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investment) return;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    try {
      await addContribution.mutateAsync({
        investment,
        amount: amt,
        valueChange: valueChange === "" ? amt : parseFloat(valueChange) || 0,
        accountId: accountId === "none" ? null : accountId,
        note,
        date,
      });
      setAmount(""); setValueChange(""); setNote("");
      onOpenChange(false);
      toast({ title: "Investment updated!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Invest more{investment ? ` — ${investment.name}` : ""}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount invested ({investment?.currency})</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="bg-secondary" required min="0" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label>Value added (optional)</Label>
            <Input type="number" inputMode="decimal" value={valueChange} onChange={e => setValueChange(e.target.value)} placeholder="Defaults to the invested amount" className="bg-secondary" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label>Pay from wallet (optional)</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't deduct</SelectItem>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary" /></div>
            <div className="space-y-1.5"><Label>Note</Label><Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" className="bg-secondary" /></div>
          </div>
          <Button type="submit" className="w-full" disabled={addContribution.isPending}>
            {addContribution.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add contribution
          </Button>
        </form>

        {history.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Contribution history</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between text-sm bg-secondary/50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate">{h.note || "Contribution"}</p>
                    <p className="text-[11px] text-muted-foreground">{h.date}</p>
                  </div>
                  <span className="font-mono text-sm shrink-0">{formatCurrency(Number(h.amount), (investment?.currency || "LKR") as Currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

const InvestmentsPage = () => {
  const { data: investments = [], isLoading } = useInvestments();
  const { data: customTypes = [] } = useInvestmentTypes();
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const createType = useCreateInvestmentType();
  const deleteType = useDeleteInvestmentType();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("stock");
  const [invested, setInvested] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("LKR");
  const [contributeFor, setContributeFor] = useState<Investment | null>(null);

  const typeOptions = [
    ...BUILT_IN_INVESTMENT_TYPES,
    ...customTypes.map(t => ({ value: t.name, label: t.name })),
  ];

  const totalValue = investments.reduce((s, i) => s + i.value, 0);
  const totalInvested = investments.reduce((s, i) => s + i.invested, 0);
  const totalGain = totalValue - totalInvested;
  const gainPercent = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(1) : "0";

  // Investments can be in different currencies — a single blended total would silently
  // mix them (e.g. adding USD stock value to an LKR fixed deposit as if they were the
  // same unit). Break the summary down per currency instead.
  const byCurrency = investments.reduce((map, inv) => {
    const entry = map.get(inv.currency) || { value: 0, invested: 0 };
    entry.value += inv.value;
    entry.invested += inv.invested;
    map.set(inv.currency, entry);
    return map;
  }, new Map<string, { value: number; invested: number }>());
  const currencyBreakdown = Array.from(byCurrency.entries()).sort((a, b) => b[1].value - a[1].value);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createInvestment.mutateAsync({
        name, type, currency,
        invested: parseFloat(invested) || 0,
        value: parseFloat(value) || parseFloat(invested) || 0,
      });
      setAddOpen(false);
      setName(""); setInvested(""); setValue("");
      toast({ title: "Investment added!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      await createType.mutateAsync(newTypeName);
      setNewTypeName("");
      toast({ title: "Type added!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Investments</h1>
        <div className="flex items-center gap-2">
          <ResponsiveDialog open={typesOpen} onOpenChange={setTypesOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Types</Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="glass-card border-glass-border">
              <ResponsiveDialogHeader><ResponsiveDialogTitle>Investment Types</ResponsiveDialogTitle></ResponsiveDialogHeader>
              <form onSubmit={handleAddType} className="flex gap-2">
                <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="e.g. Crypto, Real Estate" className="bg-secondary" />
                <Button type="submit" disabled={createType.isPending}>{createType.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
              </form>
              <div className="mt-4 space-y-1.5">
                {BUILT_IN_INVESTMENT_TYPES.map(t => (
                  <div key={t.value} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                    <span>{t.label}</span>
                    <span className="text-[11px] text-muted-foreground">Built-in</span>
                  </div>
                ))}
                {customTypes.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 text-sm">
                    <span className="capitalize">{t.name}</span>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${t.name} type`} className="h-7 w-7" onClick={() => deleteType.mutate(t.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ResponsiveDialogContent>
          </ResponsiveDialog>

          <ResponsiveDialog open={addOpen} onOpenChange={setAddOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="glass-card border-glass-border">
              <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Investment</ResponsiveDialogTitle></ResponsiveDialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dialog Axiata PLC" className="bg-secondary" required /></div>
                <div className="space-y-1.5"><Label>Type</Label>
                  <ToggleSelect value={type} onValueChange={setType} options={typeOptions} />
                </div>
                <div className="space-y-1.5"><Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CURRENCY_SYMBOLS).map(([c, s]) => <SelectItem key={c} value={c}>{s} {c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Amount Invested</Label><Input type="number" value={invested} onChange={e => setInvested(e.target.value)} className="bg-secondary" required min="0" step="0.01" /></div>
                <div className="space-y-1.5"><Label>Current Value</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} className="bg-secondary" min="0" step="0.01" placeholder="Defaults to amount invested" /></div>
                <Button type="submit" className="w-full" disabled={createInvestment.isPending}>{createInvestment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Investment</Button>
              </form>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </div>

      {currencyBreakdown.length <= 1 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Portfolio Value", value: formatCurrency(totalValue, (currencyBreakdown[0]?.[0] || "LKR") as Currency), sub: null },
            { label: "Total Invested", value: formatCurrency(totalInvested, (currencyBreakdown[0]?.[0] || "LKR") as Currency), sub: null },
            { label: "Total Returns", value: formatCurrency(totalGain, (currencyBreakdown[0]?.[0] || "LKR") as Currency), sub: `+${gainPercent}%` },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-xl font-bold font-mono">{stat.value}</p>
              {stat.sub && <p className="text-xs text-success font-medium mt-0.5">{stat.sub}</p>}
            </motion.div>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Your investments span {currencyBreakdown.length} currencies — shown separately rather than blended into one misleading total.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currencyBreakdown.map(([cur, totals], i) => {
              const gain = totals.value - totals.invested;
              const pct = totals.invested > 0 ? ((gain / totals.invested) * 100).toFixed(1) : "0";
              return (
                <motion.div key={cur} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card p-4">
                  <p className="text-xs font-semibold text-muted-foreground tracking-normal mb-2">{cur}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Value</span>
                    <span className="font-mono font-bold">{formatCurrency(totals.value, cur as Currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Invested</span>
                    <span className="font-mono">{formatCurrency(totals.invested, cur as Currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Return</span>
                    <span className={`font-mono font-medium ${gain >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(gain, cur as Currency)} ({pct}%)
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {investments.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground"><p>No investments yet.</p></div>
      ) : (
        <div className="space-y-3">
          {investments.map((inv, i) => {
            const Icon = typeIcons[inv.type] || BarChart3;
            const gain = inv.value - inv.invested;
            const gainPct = inv.invested > 0 ? ((gain / inv.invested) * 100).toFixed(1) : "0";
            const isPositive = gain >= 0;
            return (
              <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass-card-hover p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0"><Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm sm:text-base">{inv.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{prettyType(inv.type)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold font-mono text-sm sm:text-base">{formatCurrency(inv.value, inv.currency as Currency)}</p>
                  <div className={`flex items-center gap-1 justify-end text-[10px] sm:text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span className="hidden sm:inline">{isPositive ? "+" : ""}{formatCurrency(gain, inv.currency as Currency)}</span>
                    ({gainPct}%)
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => setContributeFor(inv)}>
                  <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Invest</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${inv.name}`} className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card border-glass-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {inv.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the investment and its full contribution history. Any wallet deductions already
                        recorded for past contributions won't be refunded automatically — you'd need to add that back
                        manually if needed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteInvestment.mutate(inv.id, {
                          onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                        })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </motion.div>
            );
          })}
        </div>
      )}

      <ContributeDialog investment={contributeFor} open={!!contributeFor} onOpenChange={(o) => !o && setContributeFor(null)} />
    </div>
  );
};

export default InvestmentsPage;
