import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, TrendingUp, TrendingDown, ChevronRight, ArrowLeft,
  Wallet as WalletIcon, Trophy, Flame, PiggyBank,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useBudgets } from "@/hooks/useBudgets";
import { useConvertToBase } from "@/hooks/useExchangeRates";
import { formatCurrency, Currency } from "@/lib/data";
import { cn, toLocalISODate } from "@/lib/utils";
import { ToggleSelect } from "@/components/ui/toggle-select";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

const COLORS = [
  "hsl(173, 80%, 40%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)",
  "hsl(142, 71%, 45%)", "hsl(280, 65%, 60%)", "hsl(0, 72%, 51%)",
  "hsl(330, 75%, 55%)", "hsl(45, 90%, 55%)", "hsl(210, 60%, 55%)",
  "hsl(160, 50%, 45%)",
];

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

const RANGE_OPTIONS = [
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISODate(d: Date) {
  return toLocalISODate(d);
}

function getRangeBounds(range: string): { start: string | null; end: string | null } {
  const now = new Date();
  switch (range) {
    case "thisMonth":
      return { start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), end: null };
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toISODate(start), end: toISODate(end) };
    }
    case "3m":
      return { start: toISODate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), end: null };
    case "6m":
      return { start: toISODate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), end: null };
    case "ytd":
      return { start: toISODate(new Date(now.getFullYear(), 0, 1)), end: null };
    default:
      return { start: null, end: null };
  }
}

/** The equal-length window immediately preceding the current one, for trend comparison. */
function getPreviousRangeBounds(range: string): { start: string | null; end: string | null } {
  const { start, end } = getRangeBounds(range);
  if (!start) return { start: null, end: null };
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: toISODate(prevStart), end: toISODate(prevEnd) };
}

function parseCategory(raw: string): { main: string; sub: string | null } {
  const idx = raw.indexOf(" > ");
  if (idx === -1) return { main: raw, sub: null };
  return { main: raw.slice(0, idx), sub: raw.slice(idx + 3) };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "destructive" | "default";
}

function KpiTile({ icon, label, value, sub, tone = "default" }: KpiTileProps) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        {icon}
        <p className="text-[10px] font-semibold tracking-normal">{label}</p>
      </div>
      <p
        className={cn(
          "text-lg md:text-xl font-bold font-mono truncate",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

interface RankedRow {
  key: string;
  name: string;
  tag?: string;
  value: number;
  color: string;
  count: number;
}

function RankedList({
  rows,
  total,
  currency,
  onSelect,
  emptyLabel,
}: {
  rows: RankedRow[];
  total: number;
  currency: string;
  onSelect?: (key: string) => void;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        return (
          <button
            key={row.key}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(row.key)}
            className={cn(
              "w-full text-left group",
              onSelect && "cursor-pointer"
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-2 text-sm min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                <span className="truncate">{row.name}</span>
                {row.tag && (
                  <span className="text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5 shrink-0">
                    {row.tag}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground shrink-0">×{row.count}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <span className="font-mono text-sm font-medium">{formatCurrency(row.value, currency as Currency)}</span>
                <span className="text-[11px] text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
                {onSelect && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%`, background: row.color }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

const AnalyticsPage = () => {
  const { user } = useAuth();
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const { data: budgets = [] } = useBudgets();
  const convertToBase = useConvertToBase();

  const { data: profile } = useQuery({
    queryKey: ["profile-base-currency", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("base_currency")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });
  const baseCurrency = (profile?.base_currency || "LKR") as string;

  const [range, setRange] = useState("thisMonth");
  const [tab, setTab] = useState<string>("overview");
  const [drillMain, setDrillMain] = useState<string | null>(null);
  const [incomeDrillMain, setIncomeDrillMain] = useState<string | null>(null);
  const [subDetail, setSubDetail] = useState<{ title: string; rows: typeof scoped } | null>(null);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => { if (t.type === "income" || t.type === "expense") set.add(t.currency); });
    const list = Array.from(set).sort();
    // base currency first, if present
    list.sort((a, b) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)));
    return list;
  }, [transactions, baseCurrency]);

  const tabOptions = useMemo(
    () => [{ value: "overview", label: "Overview (all, converted)" }, ...currencies.map((c) => ({ value: c, label: c }))],
    [currencies]
  );

  const isOverview = tab === "overview";
  const activeCurrency = isOverview ? baseCurrency : tab;

  // ---- amount getter: raw for a single-currency tab, converted-to-base for overview ----
  const amountOf = (t: (typeof transactions)[number]) => (isOverview ? convertToBase(t.amount, t.currency as Currency) : t.amount);

  const { start, end } = getRangeBounds(range);
  const { start: prevStart, end: prevEnd } = getPreviousRangeBounds(range);

  const inRange = (date: string, s: string | null, e: string | null) =>
    (!s || date >= s) && (!e || date <= e);

  const scoped = useMemo(
    () =>
      transactions.filter(
        (t) => (isOverview || t.currency === activeCurrency) && inRange(t.date, start, end)
      ),
    [transactions, isOverview, activeCurrency, start, end]
  );

  const scopedPrev = useMemo(
    () =>
      prevStart
        ? transactions.filter(
            (t) => (isOverview || t.currency === activeCurrency) && inRange(t.date, prevStart, prevEnd)
          )
        : [],
    [transactions, isOverview, activeCurrency, prevStart, prevEnd]
  );

  const expenses = useMemo(() => scoped.filter((t) => t.type === "expense"), [scoped]);
  const incomes = useMemo(() => scoped.filter((t) => t.type === "income"), [scoped]);
  const prevExpenseTotal = useMemo(() => scopedPrev.filter((t) => t.type === "expense").reduce((s, t) => s + amountOf(t), 0), [scopedPrev]);
  const prevIncomeTotal = useMemo(() => scopedPrev.filter((t) => t.type === "income").reduce((s, t) => s + amountOf(t), 0), [scopedPrev]);

  const totalExpense = useMemo(() => expenses.reduce((s, t) => s + amountOf(t), 0), [expenses]);
  const totalIncome = useMemo(() => incomes.reduce((s, t) => s + amountOf(t), 0), [incomes]);
  const net = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : null;

  const daySpan = useMemo(() => {
    const s = start ? new Date(start) : (expenses.length ? new Date(expenses[expenses.length - 1].date) : new Date());
    const e = end ? new Date(end) : new Date();
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [start, end, expenses]);
  const avgDailySpend = totalExpense / daySpan;

  const expenseDelta = pctChange(totalExpense, prevExpenseTotal);
  const incomeDelta = pctChange(totalIncome, prevIncomeTotal);

  // ---- category grouping (main-level) ----
  function groupMain(list: typeof scoped): RankedRow[] {
    const map = new Map<string, { value: number; count: number }>();
    list.forEach((t) => {
      const { main } = parseCategory(t.category);
      const entry = map.get(main) || { value: 0, count: 0 };
      entry.value += amountOf(t);
      entry.count += 1;
      map.set(main, entry);
    });
    return Array.from(map.entries())
      .map(([name, v], i) => ({ key: name, name, value: v.value, count: v.count, color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }

  // ---- category grouping (sub-level, optionally scoped to one main) ----
  function groupSub(list: typeof scoped, mainFilter: string | null): RankedRow[] {
    const map = new Map<string, { value: number; count: number; main: string; label: string }>();
    list.forEach((t) => {
      const { main, sub } = parseCategory(t.category);
      if (mainFilter && main !== mainFilter) return;
      if (!mainFilter && !sub) return; // flattened view: only items that actually have a subcategory
      const label = sub || "General (no subcategory)";
      const key = mainFilter ? label : `${main} > ${label}`;
      const entry = map.get(key) || { value: 0, count: 0, main, label };
      entry.value += amountOf(t);
      entry.count += 1;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([key, v], i) => ({
        key,
        name: v.label,
        tag: mainFilter ? undefined : v.main,
        value: v.value,
        count: v.count,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, mainFilter ? undefined : 8);
  }

  // Same matching predicate as groupSub, but returns the actual transactions
  // for one row instead of the aggregate — for the "what makes up this
  // number" drill-down popup, sorted biggest first.
  function transactionsForSubKey(list: typeof scoped, mainFilter: string | null, key: string) {
    return list
      .filter((t) => {
        const { main, sub } = parseCategory(t.category);
        if (mainFilter && main !== mainFilter) return false;
        if (!mainFilter && !sub) return false;
        const label = sub || "General (no subcategory)";
        const rowKey = mainFilter ? label : `${main} > ${label}`;
        return rowKey === key;
      })
      .sort((a, b) => amountOf(b) - amountOf(a));
  }

  const expenseMainRows = useMemo(() => groupMain(expenses), [expenses]);
  const incomeMainRows = useMemo(() => groupMain(incomes), [incomes]);
  const expenseSubRows = useMemo(() => groupSub(expenses, drillMain), [expenses, drillMain]);
  const incomeSubRows = useMemo(() => groupSub(incomes, incomeDrillMain), [incomes, incomeDrillMain]);

  const handleExpenseSubClick = (key: string) => {
    const row = expenseSubRows.find((r) => r.key === key);
    setSubDetail({ title: row?.name || key, rows: transactionsForSubKey(expenses, drillMain, key) });
  };
  const handleIncomeSubClick = (key: string) => {
    const row = incomeSubRows.find((r) => r.key === key);
    setSubDetail({ title: row?.name || key, rows: transactionsForSubKey(incomes, incomeDrillMain, key) });
  };

  const topExpenseCategory = expenseMainRows[0];

  // ---- monthly trend ----
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    scoped.forEach((t) => {
      const month = t.date.substring(0, 7);
      const e = map.get(month) || { income: 0, expense: 0 };
      if (t.type === "income") e.income += amountOf(t);
      if (t.type === "expense") e.expense += amountOf(t);
      map.set(month, e);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, d]) => ({
        month: new Date(month + "-01").toLocaleString("default", { month: "short", year: "2-digit" }),
        income: d.income,
        expense: d.expense,
      }));
  }, [scoped]);

  // ---- spending by day of week ----
  const dowSpend = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach((t) => {
      const d = new Date(t.date + "T00:00:00");
      totals[d.getDay()] += amountOf(t);
    });
    return DOW_LABELS.map((label, i) => ({ label, value: totals[i] }));
  }, [expenses]);

  // ---- spending by wallet/account ----
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const walletRows = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    expenses.forEach((t) => {
      const acc = accountMap.get(t.account_id);
      const name = acc?.name || "Unknown wallet";
      const entry = map.get(name) || { value: 0, count: 0 };
      entry.value += amountOf(t);
      entry.count += 1;
      map.set(name, entry);
    });
    return Array.from(map.entries())
      .map(([name, v], i) => ({ key: name, name, value: v.value, count: v.count, color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, accountMap]);

  // ---- budget performance (this calendar month, matching currency) ----
  const monthSpendByCategory = useMemo(() => {
    const now = new Date();
    const monthStart = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === "expense" && t.date >= monthStart && (isOverview || t.currency === activeCurrency))
      .forEach((t) => {
        const amt = isOverview ? convertToBase(t.amount, t.currency as Currency) : t.amount;
        map.set(t.category, (map.get(t.category) || 0) + amt);
      });
    return map;
  }, [transactions, isOverview, activeCurrency]);

  const relevantBudgets = useMemo(
    () => budgets.filter((b) => isOverview || b.currency === activeCurrency),
    [budgets, isOverview, activeCurrency]
  );

  // ---- biggest single transactions in range ----
  const biggest = useMemo(
    () => [...expenses].sort((a, b) => amountOf(b) - amountOf(a)).slice(0, 5),
    [expenses]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <ToggleSelect options={tabOptions} value={tab} onValueChange={setTab} />
          <ToggleSelect options={RANGE_OPTIONS} value={range} onValueChange={setRange} />
        </div>
      </div>

      {currencies.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          Add some transactions to see your analytics.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiTile
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Income"
              value={formatCurrency(totalIncome, activeCurrency as Currency)}
              tone="success"
              sub={incomeDelta !== null ? `${incomeDelta >= 0 ? "+" : ""}${incomeDelta.toFixed(0)}% vs prev.` : undefined}
            />
            <KpiTile
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              label="Expenses"
              value={formatCurrency(totalExpense, activeCurrency as Currency)}
              tone="destructive"
              sub={expenseDelta !== null ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta.toFixed(0)}% vs prev.` : undefined}
            />
            <KpiTile
              icon={<PiggyBank className="h-3.5 w-3.5" />}
              label="Net"
              value={formatCurrency(net, activeCurrency as Currency)}
              tone={net >= 0 ? "success" : "destructive"}
            />
            <KpiTile
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Savings Rate"
              value={savingsRate === null ? "—" : `${savingsRate.toFixed(0)}%`}
              tone={savingsRate === null ? "default" : savingsRate >= 0 ? "success" : "destructive"}
            />
            <KpiTile
              icon={<Flame className="h-3.5 w-3.5" />}
              label="Avg Daily Spend"
              value={formatCurrency(avgDailySpend, activeCurrency as Currency)}
            />
            <KpiTile
              icon={<Trophy className="h-3.5 w-3.5" />}
              label="Top Category"
              value={topExpenseCategory ? topExpenseCategory.name : "—"}
              sub={topExpenseCategory ? formatCurrency(topExpenseCategory.value, activeCurrency as Currency) : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income vs Expense trend */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">
                Income vs Expenses {isOverview ? `(converted to ${baseCurrency})` : `(${activeCurrency})`}
              </h3>
              {monthlyTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">No data in this range.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrend}>
                      <defs>
                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value, activeCurrency as Currency)} contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="income" stroke="hsl(var(--success))" fill="url(#incomeGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" fill="url(#expenseGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

            {/* Expense: main categories */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">Spending — Main Categories</h3>
              {expenseMainRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">No expenses in this range.</p>
              ) : (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expenseMainRows} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {expenseMainRows.map((r, i) => <Cell key={i} fill={r.color} cursor="pointer" onClick={() => setDrillMain(r.name)} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value, activeCurrency as Currency)} contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center mb-3">Tap a category below to see its sub-categories →</p>
                  <RankedList rows={expenseMainRows} total={totalExpense} currency={activeCurrency} onSelect={setDrillMain} emptyLabel="No expenses yet." />
                </>
              )}
            </motion.div>

            {/* Expense: sub categories (drill-down) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">
                  {drillMain ? `Sub-categories — ${drillMain}` : "Top Sub-categories (all)"}
                </h3>
                {drillMain && (
                  <button onClick={() => setDrillMain(null)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                )}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={drillMain || "flat"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <RankedList
                    rows={expenseSubRows}
                    total={drillMain ? (expenseMainRows.find((r) => r.name === drillMain)?.value || 0) : totalExpense}
                    currency={activeCurrency}
                    onSelect={handleExpenseSubClick}
                    emptyLabel={drillMain ? "No sub-category detail for this category yet." : "No sub-categorised expenses yet — add sub-categories from the Categories page for a deeper breakdown."}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Income: main categories */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">Income — Main Categories</h3>
              {incomeMainRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">No income in this range.</p>
              ) : (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={incomeMainRows} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {incomeMainRows.map((r, i) => <Cell key={i} fill={r.color} cursor="pointer" onClick={() => setIncomeDrillMain(r.name)} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value, activeCurrency as Currency)} contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <RankedList rows={incomeMainRows} total={totalIncome} currency={activeCurrency} onSelect={setIncomeDrillMain} emptyLabel="No income yet." />
                </>
              )}
            </motion.div>

            {/* Income: sub categories (drill-down) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">
                  {incomeDrillMain ? `Sub-categories — ${incomeDrillMain}` : "Top Income Sub-categories"}
                </h3>
                {incomeDrillMain && (
                  <button onClick={() => setIncomeDrillMain(null)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                )}
              </div>
              <RankedList
                rows={incomeSubRows}
                total={incomeDrillMain ? (incomeMainRows.find((r) => r.name === incomeDrillMain)?.value || 0) : totalIncome}
                currency={activeCurrency}
                onSelect={handleIncomeSubClick}
                emptyLabel={incomeDrillMain ? "No sub-category detail for this category yet." : "No sub-categorised income yet."}
              />
            </motion.div>

            {/* Spending by day of week */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">Spending by Day of Week</h3>
              {totalExpense === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">No expenses in this range.</p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dowSpend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value, activeCurrency as Currency)} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {dowSpend.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

            {/* Spending by wallet */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4 flex items-center gap-2">
                <WalletIcon className="h-3.5 w-3.5" /> Spending by Wallet
              </h3>
              <RankedList rows={walletRows} total={totalExpense} currency={activeCurrency} emptyLabel="No expenses in this range." />
            </motion.div>

            {/* Budget performance */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-6">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">Budget Performance (this month)</h3>
              {relevantBudgets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">
                  No budgets set {isOverview ? "" : `in ${activeCurrency}`} yet — set one from the Budgets page.
                </p>
              ) : (
                <div className="space-y-3">
                  {relevantBudgets.map((b) => {
                    const spent = monthSpendByCategory.get(b.category) || 0;
                    const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
                    const over = pct >= 100;
                    const warn = pct >= 80 && pct < 100;
                    return (
                      <div key={b.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="truncate">{b.category}</span>
                          <span className="font-mono text-xs">
                            {formatCurrency(spent, b.currency as Currency)} / {formatCurrency(b.monthly_limit, b.currency as Currency)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              over ? "bg-destructive" : warn ? "bg-warning" : "bg-success"
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Biggest transactions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-normal mb-4">Biggest Expenses in This Range</h3>
              {biggest.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No expenses in this range.</p>
              ) : (
                <div className="space-y-2">
                  {biggest.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="truncate">{t.description || parseCategory(t.category).main}</p>
                        <p className="text-[11px] text-muted-foreground">{t.date} · {t.category}</p>
                      </div>
                      <span className="font-mono font-medium shrink-0 ml-3">{formatCurrency(amountOf(t), activeCurrency as Currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}

      <ResponsiveDialog open={!!subDetail} onOpenChange={(o) => !o && setSubDetail(null)}>
        <ResponsiveDialogContent className="glass-card border-glass-border">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{subDetail?.title}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {subDetail && (
            subDetail.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions found.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {subDetail.rows.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="truncate">{t.description || parseCategory(t.category).main}</p>
                      <p className="text-[11px] text-muted-foreground">{t.date}</p>
                    </div>
                    <span className="font-mono font-medium shrink-0 ml-3">
                      {formatCurrency(amountOf(t), activeCurrency as Currency)}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
};

export default AnalyticsPage;
