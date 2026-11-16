import { toLocalISODate } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Loader2, ChevronDown, ChevronUp, Trash2, UserPlus,
  ArrowUpRight, ArrowDownLeft, Users, Banknote,
} from "lucide-react";
import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useLendingContacts, useCreateLendingContact, useDeleteLendingContact,
  useAddLendingTransaction, useDeleteLendingTransaction,
  LendingContact, LendingTransaction, calculateContactBalance, getContactCurrency,
} from "@/hooks/useLending";
import { useConvertToBase } from "@/hooks/useExchangeRates";
import { useAccounts } from "@/hooks/useAccounts";
import { useToast } from "@/hooks/use-toast";
import { useServiceChargeExpense } from "@/hooks/useServiceChargeExpense";
import { PullToRefreshWrapper } from "@/components/PullToRefreshWrapper";
import { SwipeToDelete } from "@/components/SwipeToDelete";

// ─── Add Contact Dialog ───
function AddContactDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateLendingContact();
  const { toast } = useToast();
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ person_name: name.trim() });
      setName("");
      onOpenChange(false);
      toast({ title: "Contact added!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Person</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Friend's name" className="bg-secondary" required />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Person
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Add Transaction Dialog ───
function AddTransactionDialog({
  contact, open, onOpenChange,
}: { contact: LendingContact; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: accounts = [] } = useAccounts();
  const addTx = useAddLendingTransaction();
  const { toast } = useToast();
  const { recordServiceCharge } = useServiceChargeExpense();

  const [type, setType] = useState<LendingTransaction["type"]>("lent");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("LKR");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toLocalISODate(new Date()));
  const [accountId, setAccountId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [hasServiceCharge, setHasServiceCharge] = useState(false);
  const [serviceChargeAmount, setServiceChargeAmount] = useState("");

  // Determine if this is a cross-currency repayment
  const isRepayment = type === "repaid_to_me" || type === "repaid_by_me";
  // Find original lending currency from previous transactions
  const originalTxs = contact.transactions.filter(t => t.type === "lent" || t.type === "borrowed");
  const originalCurrency = originalTxs.length > 0 ? originalTxs[0].currency : "LKR";
  const isCrossCurrency = isRepayment && currency !== originalCurrency;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || !accountId) return;

    try {
      await addTx.mutateAsync({
        contact_id: contact.id,
        contact_name: contact.person_name,
        type,
        amount: amt,
        currency,
        exchange_rate: isCrossCurrency && exchangeRate ? parseFloat(exchangeRate) : null,
        base_amount: isCrossCurrency && baseAmount ? parseFloat(baseAmount) : null,
        description,
        date,
        account_id: accountId,
      });
      // Record service charge as expense if checked
      if (hasServiceCharge && parseFloat(serviceChargeAmount) > 0 && accountId) {
        const linkedAccount = accounts.find(a => a.id === accountId);
        await recordServiceCharge({
          amount: parseFloat(serviceChargeAmount),
          currency: linkedAccount?.currency || currency,
          accountId,
          date,
          description: `Service charge — ${contact.person_name}`,
        });
      }

      setAmount(""); setDescription(""); setExchangeRate(""); setBaseAmount("");
      setHasServiceCharge(false); setServiceChargeAmount("");
      onOpenChange(false);
      toast({ title: "Transaction recorded!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Record Transaction — {contact.person_name}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <ToggleSelect
              value={type}
              onValueChange={(v) => setType(v as LendingTransaction["type"])}
              options={[
                { value: "lent", label: "I Lent" },
                { value: "borrowed", label: "I Borrowed" },
                { value: "repaid_to_me", label: "Repaid to Me" },
                { value: "repaid_by_me", label: "I Repaid" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="bg-secondary" required min="0.01" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(CURRENCY_SYMBOLS).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCrossCurrency && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Cross-currency: {currency} → {originalCurrency}
              </p>
              <div className="space-y-1.5">
                <Label>Equivalent in {originalCurrency}</Label>
                <Input type="number" value={baseAmount} onChange={e => setBaseAmount(e.target.value)} placeholder="0.00" className="bg-secondary" step="0.01" min="0" />
              </div>
              {amount && baseAmount && (
                <p className="text-xs text-muted-foreground">
                  Rate: 1 {currency} = {(parseFloat(baseAmount) / parseFloat(amount)).toFixed(4)} {originalCurrency}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this for?" className="bg-secondary" />
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary" />
          </div>

          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({formatCurrency(a.balance, a.currency as Currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const selectedAccount = accounts.find(a => a.id === accountId);
              return selectedAccount && selectedAccount.currency !== currency ? (
                <p className="text-[10px] text-destructive">
                  ⚠ This wallet is in {selectedAccount.currency}, but the amount above is {currency} — the raw number
                  will be deducted as-is, not converted.
                </p>
              ) : null;
            })()}
          </div>

          {accountId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lending-service-charge"
                  checked={hasServiceCharge}
                  onCheckedChange={(v) => setHasServiceCharge(v === true)}
                />
                <Label htmlFor="lending-service-charge" className="text-sm cursor-pointer">
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

          <Button type="submit" className="w-full" disabled={addTx.isPending || !accountId}>
            {addTx.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record
          </Button>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Contact Card ───
function ContactCard({ contact }: { contact: LendingContact }) {
  const [expanded, setExpanded] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const deleteTx = useDeleteLendingTransaction();
  const deleteContact = useDeleteLendingContact();
  const { toast } = useToast();

  const balance = calculateContactBalance(contact.transactions);
  const contactCurrency = getContactCurrency(contact.transactions) as Currency;
  const balanceLabel = balance > 0
    ? `Owes you ${formatCurrency(balance, contactCurrency)}`
    : balance < 0
    ? `You owe ${formatCurrency(Math.abs(balance), contactCurrency)}`
    : "Settled";

  // If this contact's lent/borrowed history actually spans more than one currency
  // (not just a cross-currency repayment, which is already normalised via base_amount),
  // the single balance above can't faithfully represent it — say so rather than mislead.
  const originalCurrencies = new Set(
    contact.transactions.filter((t) => t.type === "lent" || t.type === "borrowed").map((t) => t.currency)
  );
  const hasMixedCurrencies = originalCurrencies.size > 1;

  const handleDeleteContact = async () => {
    try {
      await deleteContact.mutateAsync(contact.id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const txTypeLabel = (type: string) => {
    switch (type) {
      case "lent": return "Lent";
      case "borrowed": return "Borrowed";
      case "repaid_to_me": return "Repaid to me";
      case "repaid_by_me": return "I repaid";
      default: return type;
    }
  };

  const txColor = (type: string) => {
    return type === "lent" || type === "repaid_by_me"
      ? "text-destructive"
      : "text-success";
  };

  const txSign = (type: string) => {
    return type === "lent" || type === "repaid_by_me" ? "-" : "+";
  };

  return (
    <SwipeToDelete onDelete={handleDeleteContact} itemLabel="Contact removed">
      <motion.div
        layout
        className="glass-card rounded-xl border border-glass-border overflow-hidden"
      >
        <button
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{contact.person_name}</p>
              <p className={`text-sm font-medium ${balance > 0 ? "text-success" : balance < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {balanceLabel}
              </p>
              {hasMixedCurrencies && (
                <p className="text-[10px] text-warning mt-0.5">
                  ⚠ Mixed currencies — balance may not be accurate, check transactions below
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {contact.transactions.length} txn{contact.transactions.length !== 1 ? "s" : ""}
            </Badge>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-glass-border"
            >
              <div className="p-4 space-y-3">
                <Button size="sm" variant="outline" onClick={() => setAddTxOpen(true)} className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Record Transaction
                </Button>

                {contact.transactions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                )}

                {contact.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {(tx.type === "lent" || tx.type === "repaid_by_me") ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-success shrink-0" />
                        )}
                        <span className="text-sm font-medium">{txTypeLabel(tx.type)}</span>
                        {tx.base_amount && tx.currency !== "LKR" && (
                          <Badge variant="outline" className="text-[10px] py-0">cross-currency</Badge>
                        )}
                      </div>
                      {tx.description && <p className="text-xs text-muted-foreground mt-0.5 ml-5.5 truncate">{tx.description}</p>}
                      <p className="text-[11px] text-muted-foreground ml-5.5">{tx.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${txColor(tx.type)}`}>
                          {txSign(tx.type)}{formatCurrency(tx.amount, tx.currency as Currency)}
                        </p>
                        {tx.base_amount && tx.currency !== "LKR" && (
                          <p className="text-[10px] text-muted-foreground">
                            ≈ {formatCurrency(tx.base_amount, "LKR")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteTx.mutateAsync(tx)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AddTransactionDialog contact={contact} open={addTxOpen} onOpenChange={setAddTxOpen} />
      </motion.div>
    </SwipeToDelete>
  );
}

// ─── Page ───
const LendingPage = () => {
  const { data: contacts = [], isLoading } = useLendingContacts();
  const [addOpen, setAddOpen] = useState(false);
  const convertToBase = useConvertToBase();

  // Summary — each contact's balance is in its own currency, so convert to base before summing.
  const summary = contacts.reduce(
    (acc, c) => {
      const bal = calculateContactBalance(c.transactions);
      const currency = getContactCurrency(c.transactions) as Currency;
      const converted = convertToBase(bal, currency);
      if (converted > 0) acc.theyOwe += converted;
      else if (converted < 0) acc.iOwe += Math.abs(converted);
      return acc;
    },
    { theyOwe: 0, iOwe: 0 }
  );

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
            <h1 className="text-2xl font-bold">Lend & Borrow</h1>
            <p className="text-sm text-muted-foreground">Track money with friends</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Add Person
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-xl border border-glass-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">They Owe You</span>
            </div>
            <p className="text-lg font-bold text-success">{formatCurrency(summary.theyOwe, "LKR")}</p>
          </div>
          <div className="glass-card rounded-xl border border-glass-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownLeft className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">You Owe</span>
            </div>
            <p className="text-lg font-bold text-destructive">{formatCurrency(summary.iOwe, "LKR")}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-3">
          Converted to LKR for this summary — each person's own balance below shows in the currency you actually lent or borrowed in.
        </p>

        {contacts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Banknote className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No lending contacts yet</p>
            <p className="text-sm mt-1">Add a person to start tracking</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        )}

        <AddContactDialog open={addOpen} onOpenChange={setAddOpen} />
      </div>
    </PullToRefreshWrapper>
  );
};

export default LendingPage;
