import { toLocalISODate } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wallet, Building2, CreditCard, DollarSign, ArrowRightLeft, Loader2 } from "lucide-react";
import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import { useConvertToBase } from "@/hooks/useExchangeRates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { useAccounts, useCreateAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const iconMap: Record<string, React.ElementType> = {
  Wallet, Building2, CreditCard, DollarSign,
};

const AccountsPage = () => {
  const { data: accounts = [], isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const createTransaction = useCreateTransaction();
  const convertToBase = useConvertToBase();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<null | { id: string; name: string; currency: string; transfer_charge: number }>(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("bank");
  const [newCurrency, setNewCurrency] = useState("LKR");
  const [newBalance, setNewBalance] = useState("");
  const [newTransferCharge, setNewTransferCharge] = useState("");

  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const totalBalance = accounts.reduce(
    (sum, a) => sum + convertToBase(a.balance, a.currency as Currency), 0
  );

  const grouped = {
    cash: accounts.filter((a) => a.type === "cash"),
    bank: accounts.filter((a) => a.type === "bank"),
    credit_card: accounts.filter((a) => a.type === "credit_card"),
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createAccount.mutateAsync({
        name: newName,
        type: newType,
        currency: newCurrency,
        balance: parseFloat(newBalance) || 0,
        transfer_charge: parseFloat(newTransferCharge) || 0,
        icon: newType === "credit_card" ? "CreditCard" : newType === "bank" ? "Building2" : "Wallet",
        color: "primary",
      });
      setAddOpen(false);
      setNewName(""); setNewBalance(""); setNewTransferCharge("");
      toast({ title: "Account added!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!fromAccount || !toAccount || !amount || fromAccount === toAccount) return;
    const from = accounts.find(a => a.id === fromAccount);
    if (!from) return;
    try {
      await createTransaction.mutateAsync({
        account_id: fromAccount,
        to_account_id: toAccount,
        type: "transfer",
        amount,
        currency: from.currency,
        category: "Transfer",
        description: "Internal Transfer",
        date: toLocalISODate(new Date()),
      });
      setTransferOpen(false);
      setTransferAmount("");
      toast({ title: "Transfer complete!" });
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total Balance: <span className="font-mono font-semibold text-foreground">{formatCurrency(totalBalance)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <ResponsiveDialog open={transferOpen} onOpenChange={setTransferOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="glass-card border-glass-border">
              <ResponsiveDialogHeader><ResponsiveDialogTitle>Transfer Between Accounts</ResponsiveDialogTitle></ResponsiveDialogHeader>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>From Account</Label>
                  <Select value={fromAccount} onValueChange={setFromAccount}>
                    <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency as Currency)})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>To Account</Label>
                  <Select value={toAccount} onValueChange={setToAccount}>
                    <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.id !== fromAccount).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount</Label>
                  <Input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" className="bg-secondary" required min="0.01" step="0.01" />
                </div>
                <Button type="submit" className="w-full" disabled={createTransaction.isPending}>
                  {createTransaction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Transfer
                </Button>
              </form>
            </ResponsiveDialogContent>
          </ResponsiveDialog>

          <ResponsiveDialog open={addOpen} onOpenChange={setAddOpen}>
            <ResponsiveDialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Account
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="glass-card border-glass-border">
              <ResponsiveDialogHeader><ResponsiveDialogTitle>Add Account</ResponsiveDialogTitle></ResponsiveDialogHeader>
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Account Name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. BOC Savings" className="bg-secondary" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <ToggleSelect
                    value={newType}
                    onValueChange={setNewType}
                    options={[
                      { value: "cash", label: "Cash" },
                      { value: "bank", label: "Bank" },
                      { value: "credit_card", label: "Credit Card" },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={newCurrency} onValueChange={setNewCurrency}>
                    <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CURRENCY_SYMBOLS).map(([code, sym]) => (
                        <SelectItem key={code} value={code}>{sym} {code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Opening Balance</Label>
                  <Input type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="0.00" className="bg-secondary" step="0.01" />
                </div>
                <div className="space-y-1.5">
                  <Label>Transfer Charge</Label>
                  <Input type="number" value={newTransferCharge} onChange={e => setNewTransferCharge(e.target.value)} placeholder="0.00" className="bg-secondary" step="0.01" min="0" />
                  <p className="text-xs text-muted-foreground">Fee charged when sending money to another bank</p>
                </div>
                <Button type="submit" className="w-full" disabled={createAccount.isPending}>
                  {createAccount.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Account
                </Button>
              </form>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No accounts yet. Add your first account to get started!</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, accs]) =>
          accs.length > 0 ? (
            <div key={type} className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground tracking-normal">
                {type === "credit_card" ? "Credit Cards" : type === "bank" ? "Bank Accounts" : "Cash"}
              </h2>
              {accs.map((account, i) => {
                const Icon = iconMap[account.icon] || Wallet;
                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card-hover p-4 sm:p-5 flex items-center gap-3 sm:gap-4 cursor-pointer"
                    onClick={() => setEditAccount({ id: account.id, name: account.name, currency: account.currency, transfer_charge: account.transfer_charge })}
                  >
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.currency} Account</p>
                    </div>
                    <p className={`text-sm sm:text-lg font-bold font-mono shrink-0 ${account.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                      {formatCurrency(account.balance, account.currency as Currency)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          ) : null
        )
      )}

      {/* Edit Account Dialog */}
      <ResponsiveDialog open={!!editAccount} onOpenChange={(open) => !open && setEditAccount(null)}>
        <ResponsiveDialogContent className="glass-card border-glass-border">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>Edit Account</ResponsiveDialogTitle></ResponsiveDialogHeader>
          {editAccount && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                try {
                  await updateAccount.mutateAsync({
                    id: editAccount.id,
                    name: form.get("name") as string,
                    currency: form.get("currency") as string,
                    transfer_charge: parseFloat(form.get("transfer_charge") as string) || 0,
                  });
                  setEditAccount(null);
                  toast({ title: "Account updated!" });
                } catch (error: any) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Account Name</Label>
                <Input name="name" defaultValue={editAccount.name} className="bg-secondary" required />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select name="currency" defaultValue={editAccount.currency}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CURRENCY_SYMBOLS).map(([code, sym]) => (
                      <SelectItem key={code} value={code}>{sym} {code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Transfer Charge</Label>
                <Input name="transfer_charge" type="number" defaultValue={editAccount.transfer_charge} placeholder="0.00" className="bg-secondary" step="0.01" min="0" />
                <p className="text-xs text-muted-foreground">Fee charged when sending money to another bank</p>
              </div>
              <Button type="submit" className="w-full" disabled={updateAccount.isPending}>
                {updateAccount.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </form>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
};

export default AccountsPage;
