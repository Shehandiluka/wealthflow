import { toLocalISODate } from "@/lib/utils";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useSmsImports } from "@/hooks/useSmsImports";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Plus, Search, Loader2, Download, Pencil, ChevronDown, ChevronUp, Inbox, ShoppingCart, Clock } from "lucide-react";

import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTransactions, useCreateTransaction, useDeleteTransaction, Transaction } from "@/hooks/useTransactions";
import { usePendingPayLaterItems } from "@/hooks/usePayLater";
import { useAccounts, useCreateAccount } from "@/hooks/useAccounts";
import { useTrips } from "@/hooks/useTrips";
import { useToast } from "@/hooks/use-toast";
import { useBudgetAlertCheck } from "@/hooks/useBudgetAlertCheck";
import { ReceiptScanner } from "@/components/transactions/ReceiptScanner";
import { CategorySelect } from "@/components/CategorySelect";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { EditTransactionDialog } from "@/components/transactions/EditTransactionDialog";
import { TransactionDetails } from "@/components/transactions/TransactionDetails";
import { Checkbox } from "@/components/ui/checkbox";
import { useServiceChargeExpense } from "@/hooks/useServiceChargeExpense";
import { PullToRefreshWrapper } from "@/components/PullToRefreshWrapper";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { QuickAddBar } from "@/components/transactions/QuickAddBar";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const typeConfig = {
  income: { icon: ArrowDownLeft, colorClass: "text-success", bgClass: "bg-success/10", label: "Income" },
  expense: { icon: ArrowUpRight, colorClass: "text-destructive", bgClass: "bg-destructive/10", label: "Expense" },
  transfer: { icon: ArrowRightLeft, colorClass: "text-primary", bgClass: "bg-primary/10", label: "Transfer" },
};

const TransactionsPage = () => {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: pendingData } = usePendingPayLaterItems();
  const pendingPurchases = pendingData?.items || [];
  const tabRemaining = pendingData?.tabRemaining || new Map<string, number>();
  const { data: accounts = [] } = useAccounts();
  const { data: trips = [] } = useTrips();
  const createTransaction = useCreateTransaction();
  const createAccount = useCreateAccount();
  const { toast } = useToast();
  const checkBudgetAlert = useBudgetAlertCheck();
  const { data: drafts = [] } = useSmsImports();
  const pendingDrafts = drafts.filter(d => d.status === "pending").length;

  const deleteTransaction = useDeleteTransaction();
  const { recordServiceCharge } = useServiceChargeExpense();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Form state
  const [txType, setTxType] = useState("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Food");
  const [txDescription, setTxDescription] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txToAccountId, setTxToAccountId] = useState("");
  const [txDate, setTxDate] = useState(toLocalISODate(new Date()));
  const [txTripId, setTxTripId] = useState<string>("");
  const [txExchangeRate, setTxExchangeRate] = useState("");
  const [txTransferCharge, setTxTransferCharge] = useState("");
  const [txReceivedAmount, setTxReceivedAmount] = useState("");
  const [crossCurrencyMode, setCrossCurrencyMode] = useState<"rate" | "amount">("amount");
  const [hasServiceCharge, setHasServiceCharge] = useState(false);
  const [serviceChargeAmount, setServiceChargeAmount] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const fromAccount = accounts.find(a => a.id === txAccountId);
  const toAccount = accounts.find(a => a.id === txToAccountId);
  const isCrossCurrency = txType === "transfer" && fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  // Smart defaults: most-used account & last-used category
  const smartDefaults = useMemo(() => {
    if (transactions.length === 0) return { accountId: accounts[0]?.id || "", category: "Food" };
    const accountCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    transactions.forEach(tx => {
      accountCounts[tx.account_id] = (accountCounts[tx.account_id] || 0) + 1;
      if (tx.type === "expense") categoryCounts[tx.category] = (categoryCounts[tx.category] || 0) + 1;
    });
    const topAccount = Object.entries(accountCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || accounts[0]?.id || "";
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Food";
    return { accountId: topAccount, category: topCategory };
  }, [transactions, accounts]);

  // Most-used categories for the selected type — one-tap chips
  const quickCategories = useMemo(() => {
    if (txType === "transfer") return [];
    const counts: Record<string, number> = {};
    transactions.filter(tx => tx.type === txType).forEach(tx => {
      counts[tx.category] = (counts[tx.category] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
    if (txCategory && !top.includes(txCategory)) top.unshift(txCategory);
    return top.slice(0, 6);
  }, [transactions, txType, txCategory]);


  // Auto-set account when dialog opens and no account selected
  const handleDialogOpen = (open: boolean) => {
    setAddOpen(open);
    if (open) {
      if (!txAccountId && smartDefaults.accountId) setTxAccountId(smartDefaults.accountId);
      if (txCategory === "Food" && smartDefaults.category !== "Food") setTxCategory(smartDefaults.category);
    }
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(tx => months.add(tx.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const exportCSV = (month?: string) => {
    const txToExport = month
      ? transactions.filter(tx => tx.date.startsWith(month))
      : filtered;
    if (txToExport.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const header = "Date,Type,Category,Description,Amount,Currency\n";
    const rows = txToExport.map(tx =>
      `${tx.date},${tx.type},${tx.category},"${tx.description.replace(/"/g, '""')}",${tx.type === "expense" ? "-" : ""}${tx.amount},${tx.currency}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions${month ? `-${month}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV downloaded!" });
  };

  const filtered = transactions
    .filter((tx) => filter === "all" || tx.type === filter)
    .filter((tx) => tx.description.toLowerCase().includes(search.toLowerCase()) || tx.category.toLowerCase().includes(search.toLowerCase()));

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter an amount greater than 0", variant: "destructive" });
      return;
    }

    let accountId = txAccountId;

    if (!accountId) {
      try {
        const newAccount = await createAccount.mutateAsync({
          name: "Cash",
          type: "cash",
          balance: 0,
        });
        accountId = newAccount.id;
      } catch (err: any) {
        toast({ title: "Error creating account", description: err.message, variant: "destructive" });
        return;
      }
    }
    try {
      const account = accounts.find(a => a.id === accountId);
      const transferData: any = {
        account_id: accountId,
        type: txType,
        amount,
        currency: account?.currency || "LKR",
        category: txType === "transfer" ? "Transfer" : txCategory,
        description: txDescription || txCategory,
        date: txDate,
        to_account_id: txType === "transfer" ? txToAccountId : null,
        trip_id: (txTripId && txTripId !== "none") ? txTripId : null,
      };
      if (txType === "transfer" && isCrossCurrency) {
        if (crossCurrencyMode === "amount") {
          const received = parseFloat(txReceivedAmount) || 0;
          const charge = parseFloat(txTransferCharge) || 0;
          const rate = amount > 0 ? (received + charge) / amount : 1;
          transferData.exchange_rate = parseFloat(rate.toFixed(6));
          transferData.transfer_charge = charge;
        } else {
          transferData.exchange_rate = parseFloat(txExchangeRate) || 1;
          transferData.transfer_charge = parseFloat(txTransferCharge) || 0;
        }
      }
      await createTransaction.mutateAsync(transferData);

      // Record service charge as expense if checked
      if (hasServiceCharge && parseFloat(serviceChargeAmount) > 0 && accountId) {
        const acct = accounts.find(a => a.id === accountId);
        await recordServiceCharge({
          amount: parseFloat(serviceChargeAmount),
          currency: acct?.currency || "LKR",
          accountId,
          date: txDate,
          description: `Service charge — ${txType === "transfer" ? "Transfer" : txDescription || txCategory}`,
        });
      }

      setAddOpen(false);
      setTxAmount(""); setTxDescription(""); setTxExchangeRate(""); setTxTransferCharge(""); setTxReceivedAmount("");
      setHasServiceCharge(false); setServiceChargeAmount(""); setShowMoreOptions(false);
      toast({ title: "Transaction added!" });
      checkBudgetAlert(txType === "transfer" ? "Transfer" : txCategory, txType);
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
    <PullToRefreshWrapper className="h-full">
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-4">
      {/* Quick Add Bar */}
      <QuickAddBar
        lastUsedAccountId={smartDefaults.accountId}
        lastUsedCategory={smartDefaults.category}
        onOpenFull={() => {
          if (!txAccountId && smartDefaults.accountId) setTxAccountId(smartDefaults.accountId);
          setAddOpen(true);
        }}
      />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          <Button asChild size="sm" variant="outline" className="gap-1.5 h-9 text-xs relative">
            <Link to="/sms-imports">
              <Inbox className="h-3.5 w-3.5" /> Drafts
              {pendingDrafts > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {pendingDrafts}
                </span>
              )}
            </Link>
          </Button>
          <ReceiptScanner />

          <Select onValueChange={(val) => {
            if (val === "all") exportCSV();
            else exportCSV(val);
          }}>
            <SelectTrigger className="w-auto gap-1 sm:gap-1.5 h-9 text-xs bg-secondary border-border">
              <Download className="h-3.5 w-3.5" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              {availableMonths.map(m => {
                const label = new Date(m + "-01").toLocaleString("default", { month: "long", year: "numeric" });
                return <SelectItem key={m} value={m}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>

          <ResponsiveDialog open={addOpen} onOpenChange={handleDialogOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Full Form
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="glass-card border-glass-border">
              <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Transaction</ResponsiveDialogTitle></ResponsiveDialogHeader>
              <form onSubmit={handleAddTransaction} className="space-y-5">
                {/* Type */}
                <ToggleSelect
                  value={txType}
                  onValueChange={setTxType}
                  className="justify-center"
                  options={[
                    { value: "expense", label: "Expense" },
                    { value: "income", label: "Income" },
                    { value: "transfer", label: "Transfer" },
                  ]}
                />

                {/* Big amount pad */}
                <div className="rounded-2xl bg-secondary/60 border border-glass-border p-4 text-center space-y-3">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-2xl font-semibold text-muted-foreground">
                      {CURRENCY_SYMBOLS[(fromAccount?.currency || "LKR") as Currency]}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={txAmount}
                      onChange={e => setTxAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      min="0.01"
                      step="0.01"
                      autoFocus
                      className="w-full max-w-[220px] bg-transparent border-0 outline-none text-center text-4xl font-bold tracking-tight placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[10, 50, 100, 500, 1000].map(step => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setTxAmount(String((parseFloat(txAmount) || 0) + step))}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background/60 border border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        +{step}
                      </button>
                    ))}
                    {txAmount && (
                      <button
                        type="button"
                        onClick={() => setTxAmount("")}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background/60 border border-border text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Category — tap chips first, dropdown for the rest */}
                {txType !== "transfer" && (
                  <div className="space-y-2">
                    <Label className="text-xs tracking-normal text-muted-foreground">Category</Label>
                    {quickCategories.length > 0 && (
                      <ToggleSelect
                        value={txCategory}
                        onValueChange={setTxCategory}
                        options={quickCategories.map(c => ({ value: c, label: c }))}
                      />
                    )}
                    <CategorySelect value={txCategory} onValueChange={setTxCategory} kind={txType === "income" ? "income" : "expense"} />
                  </div>
                )}

                {/* Account — chips when few, dropdown when many */}
                <div className="space-y-2">
                  <Label className="text-xs tracking-normal text-muted-foreground">{txType === "transfer" ? "From Account" : "Account"}</Label>
                  {accounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-secondary rounded-md p-2.5">
                      No accounts yet — a "Cash" account will be created automatically.
                    </p>
                  ) : accounts.length <= 6 ? (
                    <ToggleSelect
                      value={txAccountId}
                      onValueChange={setTxAccountId}
                      options={accounts.map(a => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
                    />
                  ) : (
                    <Select value={txAccountId} onValueChange={setTxAccountId}>
                      <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {txType === "transfer" && (
                  <div className="space-y-2">
                    <Label className="text-xs tracking-normal text-muted-foreground">To Account</Label>
                    {accounts.filter(a => a.id !== txAccountId).length <= 6 ? (
                      <ToggleSelect
                        value={txToAccountId}
                        onValueChange={setTxToAccountId}
                        options={accounts.filter(a => a.id !== txAccountId).map(a => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
                      />
                    ) : (
                      <Select value={txToAccountId} onValueChange={setTxToAccountId}>
                        <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => a.id !== txAccountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
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

                {/* More Options — collapsible */}
                <button
                  type="button"
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {showMoreOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  More options
                </button>

                {showMoreOptions && (
                  <div className="space-y-4 rounded-lg bg-muted/30 p-3">
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
                            id="tx-service-charge"
                            checked={hasServiceCharge}
                            onCheckedChange={(v) => setHasServiceCharge(v === true)}
                          />
                          <Label htmlFor="tx-service-charge" className="text-sm cursor-pointer">
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
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={createTransaction.isPending}>
                  {createTransaction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Transaction
                </Button>
              </form>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </div>

      {pendingPurchases.length > 0 && (
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setShowPending((s) => !s)}
            className="w-full flex items-center justify-between gap-2 p-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-warning" />
              Pending Pay Later ({pendingPurchases.length})
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPending ? "rotate-180" : ""}`} />
          </button>
          {showPending && (
            <div className="divide-y divide-border border-t border-border">
              {pendingPurchases.map((item) => (
                <Link
                  key={item.id}
                  to="/pay-later"
                  className="flex items-center gap-3 p-3.5 hover:bg-secondary/30 transition-colors border-l-2 border-l-warning"
                >
                  <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.description || item.category}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.person_or_store} · {item.category} · {item.purchased_at}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold font-mono text-warning">
                      {formatCurrency(item.amount, item.currency as Currency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatCurrency(tabRemaining.get(item.pay_later_id) ?? item.amount, item.currency as Currency)} remaining on tab
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "income", "expense", "transfer"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize text-xs"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <p>No transactions found. Add your first transaction!</p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-border overflow-hidden">
          {filtered.map((tx, i) => {
            const config = typeConfig[tx.type as keyof typeof typeConfig] || typeConfig.expense;
            const Icon = config.icon;

            return (
              <SwipeToDelete
                key={tx.id}
                itemLabel="Transaction deleted"
                onDelete={() => deleteTransaction.mutate(tx)}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => { setDetailTx(tx); setDetailOpen(true); }}
                >
                  {(() => {
                    const isTransfer = tx.type === "transfer";
                    const from = accounts.find(a => a.id === tx.account_id);
                    const to = accounts.find(a => a.id === tx.to_account_id);
                    const rate = tx.exchange_rate || 1;
                    const received = tx.amount * rate - (tx.transfer_charge || 0);
                    const title = isTransfer
                      ? `${from?.name || "Account"} → ${to?.name || "Account"}`
                      : tx.description;
                    const subtitle = isTransfer
                      ? (tx.description && tx.description !== "Transfer" ? `${tx.description} · ${tx.date}` : tx.date)
                      : `${tx.category} · ${tx.date}`;
                    return (
                      <>
                        <div className={`h-9 w-9 rounded-lg ${config.bgClass} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-4 w-4 ${config.colorClass}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{title}</p>
                          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold font-mono ${tx.type === "income" ? "text-success" : tx.type === "expense" ? "text-destructive" : "text-foreground"}`}>
                            {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                            {formatCurrency(tx.amount, (from?.currency || tx.currency) as Currency)}
                          </p>
                          {isTransfer ? (
                            <p className="text-[10px] text-muted-foreground">
                              → {formatCurrency(received, (to?.currency || tx.currency) as Currency)}
                              {tx.transfer_charge ? ` · fee ${tx.transfer_charge}` : ""}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground uppercase">{config.label}</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
                </motion.div>
              </SwipeToDelete>
            );
          })}
        </div>
      )}
    </div>

    <TransactionDetails
      transaction={detailTx}
      open={detailOpen}
      onOpenChange={setDetailOpen}
      onEdit={(tx) => { setDetailOpen(false); setEditTx(tx); setEditOpen(true); }}
      onDelete={(tx) => {
        setDetailOpen(false);
        deleteTransaction.mutate(tx);
        toast({ title: "Transaction deleted" });
      }}
    />
    <EditTransactionDialog transaction={editTx} open={editOpen} onOpenChange={setEditOpen} />
    </PullToRefreshWrapper>
  );
};

export default TransactionsPage;
