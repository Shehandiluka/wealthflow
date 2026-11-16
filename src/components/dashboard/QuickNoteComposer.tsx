import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCY_TOKENS: Record<string, string> = {
  lkr: "LKR", rs: "LKR", "rs.": "LKR", rupees: "LKR", "₨": "LKR",
  usd: "USD", $: "USD",
  eur: "EUR", "€": "EUR",
  gbp: "GBP", "£": "GBP",
  ils: "ILS", nis: "ILS", shekel: "ILS", shekels: "ILS", "₪": "ILS",
  inr: "INR", "₹": "INR",
};

const INCOME_WORDS =
  /\b(received|refund|salary|income|got paid|earned|credited|bonus|cashback)\b/i;

export function parseNote(text: string) {
  const msg = text.replace(/\s+/g, " ").trim();
  const type: "income" | "expense" = INCOME_WORDS.test(msg) ? "income" : "expense";

  const amountMatch =
    msg.match(
      /(LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪|₨)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
    ) ??
    msg.match(
      /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪|₨)/i,
    );

  let amount: number | null = null;
  let currency: string | null = null;
  if (amountMatch) {
    const [, a, b] = amountMatch;
    const numRaw = /^[0-9]/.test(a) ? a : b;
    const curRaw = /^[0-9]/.test(a) ? b : a;
    amount = Number(String(numRaw).replace(/,/g, ""));
    currency = CURRENCY_TOKENS[String(curRaw).toLowerCase().replace(/\.$/, "")] ?? null;
  } else {
    const bare = msg.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);
    if (bare) amount = Number(bare[1]);
  }

  const description =
    msg
      .replace(
        /(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪|₨)?\s*\b[0-9][0-9,]*(?:\.[0-9]{1,2})?\b\s*(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪|₨)?/i,
        " ",
      )
      .replace(/^\s*(for|on|to)\b/i, "")
      .replace(/[.,\s]+$/, "")
      .replace(/\s+/g, " ")
      .trim() || msg;

  return { amount, currency, type, description };
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface QuickNoteComposerProps {
  /** Called after a successful save or when the user cancels */
  onClose?: () => void;
  autoFocus?: boolean;
}

export function QuickNoteComposer({ onClose, autoFocus = true }: QuickNoteComposerProps) {
  const { user } = useAuth();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const currencies = Array.from(new Set(accounts.map(a => a.currency))).slice(0, 6);
  const topAccounts = accounts.slice(0, 5);
  const topCategories = (() => {
    const counts = new Map<string, number>();
    for (const tx of transactions as any[]) {
      if (!tx.category) continue;
      counts.set(tx.category, (counts.get(tx.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  })();

  const appendToken = (token: string) => {
    setText(prev => {
      const base = prev.replace(/\s+$/, "");
      if (base.toLowerCase().split(/\s+/).includes(token.toLowerCase())) return prev;
      return base ? `${base} ${token} ` : `${token} `;
    });
  };

  const guessCategory = (description: string) => {
    const lower = description.toLowerCase();
    const direct = topCategories.find(c => lower.includes(c.toLowerCase()));
    if (direct) return direct;
    const words = lower.split(/[^a-z0-9']+/).filter(w => w.length > 2);
    if (!words.length) return null;
    for (const tx of transactions as any[]) {
      const hay = `${tx.description ?? ""} ${tx.category ?? ""}`.toLowerCase();
      if (words.some(w => hay.includes(w))) return tx.category as string;
    }
    return null;
  };

  const guessAccount = (currency: string | null, description: string) => {
    const lower = description.toLowerCase();
    const byName = accounts.find(a => lower.includes(a.name.toLowerCase()));
    if (byName) return byName;
    if (!currency) return null;
    return accounts.find(a => a.currency === currency) ?? null;
  };

  const handleSave = async () => {
    const raw = text.trim();
    if (!raw || !user) return;
    setSaving(true);
    try {
      const parsed = parseNote(raw);
      const category = guessCategory(parsed.description);
      const account = guessAccount(parsed.currency, raw);
      const now = new Date().toISOString();
      const hash = await sha256Hex(`${user.id}|${raw}|${now}`);

      const { error } = await supabase.from("sms_imports").insert({
        user_id: user.id,
        sender: "Quick Note",
        message: category ? `${raw} [${category}]` : raw,
        received_at: now,
        content_hash: hash,
        parsed_amount: parsed.amount,
        parsed_type: parsed.type,
        parsed_account_ref: account?.name ?? null,
        suggested_account_id: account?.id ?? null,
        suggested_category: category,
        parsed_date: now,
        status: "pending",
      });
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["sms_imports"] });
      setText("");
      onClose?.();
      toast({
        title: "Saved to Draft Inbox",
        description: [
          parsed.amount ? `${parsed.currency ?? ""} ${parsed.amount}`.trim() : null,
          parsed.description,
          category ? `→ ${category}` : null,
        ].filter(Boolean).join(" · "),
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const chipClass =
    "px-2 py-1 rounded-full bg-secondary text-xs text-foreground hover:bg-primary/15";

  return (
    <div className="space-y-2">
      <Input
        autoFocus={autoFocus}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); handleSave(); }
          if (e.key === "Escape") onClose?.();
        }}
        placeholder="e.g. LKR 500 Milk"
        className="bg-secondary text-base"
      />

      {(currencies.length > 0 || topAccounts.length > 0 || topCategories.length > 0) && (
        <div className="space-y-1.5">
          {currencies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] tracking-normal text-muted-foreground self-center">Currency</span>
              {currencies.map(c => (
                <button key={c} type="button" onMouseDown={e => e.preventDefault()} onClick={() => appendToken(c)} className={chipClass}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {topAccounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] tracking-normal text-muted-foreground self-center">Wallet</span>
              {topAccounts.map(a => (
                <button key={a.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => appendToken(a.name)} className={chipClass}>
                  {a.name}
                </button>
              ))}
            </div>
          )}
          {topCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] tracking-normal text-muted-foreground self-center">Category</span>
              {topCategories.map(c => (
                <button key={c} type="button" onMouseDown={e => e.preventDefault()} onClick={() => appendToken(c)} className={chipClass}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Saved as a draft — review it later in your Draft Inbox.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setText(""); onClose?.(); }}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!text.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
          </Button>
        </div>
      </div>
    </div>
  );
}
