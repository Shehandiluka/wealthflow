import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRight, Plus, Trash2, Split } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { CategorySelect } from "@/components/CategorySelect";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { SmsImport } from "@/hooks/useSmsImports";
import { useQueryClient } from "@tanstack/react-query";
import { Currency, EXCHANGE_RATES, formatCurrency } from "@/lib/data";

// Detect currency code from raw SMS text
function detectSmsCurrency(message: string): Currency | null {
  const m = message.toUpperCase();
  if (/\b(LKR|RS\.?|RUPEES?)\b/.test(m)) return "LKR" as Currency;
  if (/\b(USD)\b|\$/.test(m)) return "USD" as Currency;
  if (/\b(EUR)\b|€/.test(m)) return "EUR" as Currency;
  if (/\b(GBP)\b|£/.test(m)) return "GBP" as Currency;
  if (/\b(ILS|NIS|SHEKEL|SHEKELS)\b|₪/.test(m)) return "ILS" as Currency;
  return null;
}

// Convert using LKR-base rates table: rates[CUR] = CUR per 1 LKR
function convert(amount: number, from: Currency, to: Currency, rates: Record<string, number>): number {
  if (from === to) return amount;
  const r = (c: Currency) => rates?.[c] ?? (EXCHANGE_RATES as any)[c] ?? 1;
  const inLkr = amount / r(from);
  return inLkr * r(to);
}
/** Strip the amount/currency tokens from a quick note so only the label remains */
function cleanNoteText(text: string): string {
  const cleaned = text
    .replace(
      /(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪)?\s*\b[0-9][0-9,]*(?:\.[0-9]{1,2})?\b\s*(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪)?/i,
      " ",
    )
    .replace(/^\s*(for|on|to)\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || text.trim();
}


/** Short, readable description for a bank SMS (FriMi and similar formats). */
function describeSms(sender: string, message: string): string {
  const msg = message.replace(/\s+/g, " ").trim();
  const pos = msg.match(/POS Transaction\s*-\s*(.+?)\s+was performed/i);
  if (pos) return `Card: ${pos[1]}`;
  const bill = msg.match(/BILL PAYMENT TO\s+(.+?)\s*\(/i) ?? msg.match(/BILL PAYMENT TO\s+(.+?)\s+was performed/i);
  if (bill) return `Bill: ${bill[1]}`;
  const ft = msg.match(/Fund Transfer of .+? to\s+([\dXx*]+)/i);
  if (ft) return `Transfer to ${ft[1]}`;
  return `[SMS ${sender}] ${message.slice(0, 120)}`;
}

/** Pick the wallet for a draft: the one chosen for the API key, then a
 *  wallet whose name contains the last digits of the SMS account ref. */
function pickAccountId(sms: SmsImport, accounts: { id: string; name: string }[]): string {
  if (sms.suggested_account_id && accounts.some(a => a.id === sms.suggested_account_id)) {
    return sms.suggested_account_id;
  }
  if (sms.parsed_account_ref) {
    const digits = sms.parsed_account_ref.replace(/[^0-9]/g, "");
    const full = accounts.find(a => digits && a.name.includes(digits));
    if (full) return full.id;
    const tail = digits.slice(-3);
    const byTail = accounts.find(a => tail.length === 3 && a.name.includes(tail));
    if (byTail) return byTail.id;
  }
  return accounts[0]?.id ?? "";
}

interface SplitRow {
  amount: string;
  category: string;
  description: string;
  saved?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Props {
  sms: SmsImport | null;
  onClose: () => void;
}

export function ConfirmSmsDialog({ sms, onClose }: Props) {
  const { data: accounts = [] } = useAccounts();
  const createTx = useCreateTransaction();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: rates } = useExchangeRates();

  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [autoConvert, setAutoConvert] = useState(true);
  const [splitMode, setSplitMode] = useState(false);
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [saving, setSaving] = useState(false);

  const smsCurrency: Currency | null = useMemo(
    () => (sms ? detectSmsCurrency(sms.message) : null),
    [sms]
  );
  const smsAmount = sms?.parsed_amount ?? null;
  const selectedAccount = accounts.find(a => a.id === accountId);

  const isNote = !!sms && /note/i.test(sms.sender);

  useEffect(() => {
    if (!sms) return;
    setType(sms.parsed_type === "income" ? "income" : "expense");
    setSplitMode(false);
    setRows([]);
    // Quick notes may carry a guessed category as a trailing [Category] marker
    const guessed = /note/i.test(sms.sender)
      ? sms.message.match(/\[([^\[\]]+)\]\s*$/)?.[1] ?? null
      : null;
    setCategory(
      sms.suggested_category ??
        guessed ??
        (sms.parsed_type === "income" ? "Other Income" : "Other")
    );

    setDescription(
      /note/i.test(sms.sender)
        ? cleanNoteText(sms.message.replace(/\s*\[[^\[\]]+\]\s*$/, ""))
        : describeSms(sms.sender, sms.message)
    );
    setDate((sms.parsed_date ?? sms.received_at).slice(0, 10));
    setAccountId(pickAccountId(sms, accounts));
  }, [sms, accounts]);


  // Auto-fill amount, converting if SMS currency differs from account currency
  useEffect(() => {
    if (!sms || smsAmount == null || !selectedAccount) return;
    if (autoConvert && smsCurrency && smsCurrency !== selectedAccount.currency && rates) {
      const converted = convert(smsAmount, smsCurrency, selectedAccount.currency as Currency, rates);
      setAmount(converted.toFixed(2));
    } else {
      setAmount(smsAmount.toString());
    }
  }, [sms, smsAmount, smsCurrency, selectedAccount, rates, autoConvert]);

  if (!sms) return null;

  const needsConversion =
    !!smsCurrency && !!selectedAccount && smsCurrency !== selectedAccount.currency && smsAmount != null;

  const total = round2(parseFloat(amount || "0") || 0);
  const allocated = round2(rows.reduce((s, r) => s + (parseFloat(r.amount || "0") || 0), 0));
  const remaining = round2(total - allocated);
  const splitValid =
    rows.length >= 1 &&
    Math.abs(remaining) < 0.005 &&
    rows.every(r => (parseFloat(r.amount || "0") || 0) > 0 && !!r.category);

  const startSplit = () => {
    setRows([{ amount: total ? total.toFixed(2) : "", category, description: "" }]);
    setSplitMode(true);
  };
  const cancelSplit = () => {
    if (rows.some(r => r.saved)) return; // part already saved — keep going
    setSplitMode(false);
    setRows([]);
  };
  const updateRow = (i: number, patch: Partial<SplitRow>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows(rs => [
      ...rs,
      { amount: remaining > 0 ? remaining.toFixed(2) : "", category, description: "" },
    ]);
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));

  const finishDraft = async (count: number) => {
    // Draft is fulfilled — remove it from the inbox
    await supabase.from("sms_imports").delete().eq("id", sms.id);
    qc.invalidateQueries({ queryKey: ["sms_imports"] });
    toast({
      title: count > 1 ? `${count} transactions created` : "Transaction created",
      description: "Draft removed from inbox",
    });
    onClose();
  };

  const handleSplitConfirm = async () => {
    const acct = accounts.find(a => a.id === accountId);
    if (!acct || !splitValid) return;
    setSaving(true);
    try {
      // One transaction per item, saved in order. Saved rows are marked so a
      // retry after an error never posts the same item twice.
      const work = rows.map(r => ({ ...r }));
      for (let i = 0; i < work.length; i++) {
        const r = work[i];
        if (r.saved) continue;
        await createTx.mutateAsync({
          account_id: accountId,
          type,
          amount: round2(parseFloat(r.amount)),
          currency: acct.currency,
          category: r.category,
          description: r.description.trim() || description,
          date,
        });
        setRows(rs => rs.map((x, idx) => (idx === i ? { ...x, saved: true } : x)));
        work[i].saved = true;
      }
      await finishDraft(work.length);
    } catch (err: any) {
      toast({
        title: "Some items were not saved",
        description: `${err.message} — saved items are marked; press Confirm again to save the rest.`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (splitMode) return handleSplitConfirm();
    const acct = accounts.find(a => a.id === accountId);
    if (!acct || !amount) return;
    try {
      const tx = await createTx.mutateAsync({
        account_id: accountId,
        type,
        amount: parseFloat(amount),
        currency: acct.currency,
        category,
        description,
        date,
      });
      await finishDraft(1);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ResponsiveDialog open={!!sms} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="glass-card border-glass-border">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Confirm Transaction</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleConfirm} className="space-y-3">
          <div className="rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap break-words max-h-32 overflow-auto">
            {sms.message}
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <ToggleSelect
              value={type}
              onValueChange={(v) => setType(v as "income" | "expense")}
              options={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{splitMode ? "Total" : "Amount"}</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required disabled={rows.some(r => r.saved)} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="bg-secondary" />
            </div>
          </div>
          {needsConversion && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-glass-border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">{formatCurrency(smsAmount!, smsCurrency!)}</span>
                <ArrowRight className="h-3 w-3 opacity-60" />
                <span className="font-medium">
                  {autoConvert
                    ? formatCurrency(parseFloat(amount || "0"), selectedAccount!.currency as Currency)
                    : `(${selectedAccount!.currency})`}
                </span>
                <span className="opacity-60">auto FX</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoConvert(v => !v)}
                className="text-primary hover:underline"
              >
                {autoConvert ? "Use original" : "Convert"}
              </button>
            </div>
          )}
          {!splitMode ? (
            <>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <CategorySelect value={category} onValueChange={setCategory} kind={type} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} className="bg-secondary" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={startSplit} disabled={!total}>
                <Split className="h-4 w-4 mr-2" />
                Split into several items
              </Button>
              <Button type="submit" className="w-full" disabled={createTx.isPending}>
                {createTx.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm & Create Transaction
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Items</span>
                <span
                  className={
                    Math.abs(remaining) < 0.005
                      ? "text-success"
                      : remaining < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {Math.abs(remaining) < 0.005
                    ? "Fully allocated"
                    : remaining > 0
                      ? `Remaining ${remaining.toFixed(2)}`
                      : `Over by ${Math.abs(remaining).toFixed(2)}`}
                </span>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-auto pr-0.5">
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className={`rounded-md border border-glass-border p-2 space-y-2 ${r.saved ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        placeholder="Amount"
                        value={r.amount}
                        disabled={r.saved}
                        onChange={e => updateRow(i, { amount: e.target.value })}
                        className="bg-secondary w-28 shrink-0"
                        aria-label={`Item ${i + 1} amount`}
                      />
                      <CategorySelect
                        value={r.category}
                        onValueChange={v => updateRow(i, { category: v })}
                        kind={type}
                      />
                      {r.saved ? (
                        <span className="text-[10px] text-success shrink-0">Saved</span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => removeRow(i)}
                          disabled={rows.length === 1}
                          aria-label={`Remove item ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder={`Note (default: ${description.slice(0, 40)})`}
                      value={r.description}
                      disabled={r.saved}
                      onChange={e => updateRow(i, { description: e.target.value })}
                      className="bg-secondary"
                      aria-label={`Item ${i + 1} note`}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={addRow}>
                  <Plus className="h-4 w-4 mr-1" /> Add item
                </Button>
                <Button type="button" variant="ghost" onClick={cancelSplit} disabled={rows.some(r => r.saved)}>
                  Don't split
                </Button>
              </div>
              <Button type="submit" className="w-full" disabled={!splitValid || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm {rows.length} {rows.length === 1 ? "item" : "items"}
              </Button>
            </>
          )}
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
