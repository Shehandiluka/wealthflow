import { toLocalISODate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PayLaterItem {
  id: string;
  pay_later_id: string;
  user_id: string;
  description: string;
  amount: number;
  category: string;
  purchased_at: string;
  created_at: string;
}

export interface PayLaterPayment {
  id: string;
  pay_later_id: string;
  user_id: string;
  amount: number;
  note: string;
  paid_at: string;
  created_at: string;
}

export interface PayLaterTab {
  id: string;
  user_id: string;
  person_or_store: string;
  description: string;
  amount: number;
  currency: string;
  is_paid: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  items: PayLaterItem[];
  payments: PayLaterPayment[];
}

export function usePayLater() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pay-later", user?.id],
    queryFn: async () => {
      const { data: tabs, error } = await supabase
        .from("pay_later")
        .select("*")
        .order("is_paid", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const tabIds = tabs.map((t: any) => t.id);
      if (tabIds.length === 0) return [] as PayLaterTab[];

      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from("pay_later_items").select("*").in("pay_later_id", tabIds).order("purchased_at", { ascending: false }),
        supabase.from("pay_later_payments").select("*").in("pay_later_id", tabIds).order("paid_at", { ascending: false }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      return tabs.map((tab: any) => ({
        ...tab,
        items: (itemsRes.data || []).filter((i: any) => i.pay_later_id === tab.id),
        payments: (paymentsRes.data || []).filter((p: any) => p.pay_later_id === tab.id),
      })) as PayLaterTab[];
    },
    enabled: !!user,
  });
}

/**
 * Every purchase on a tab that hasn't been fully settled yet, with the tab's
 * currency and store name attached — used to show "money you've committed to
 * but not yet paid" alongside real transactions, without them being real
 * transactions (no wallet was touched at purchase time).
 */
export function usePendingPayLaterItems() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pay-later-pending-items", user?.id],
    queryFn: async () => {
      const { data: tabs, error: tabsErr } = await supabase
        .from("pay_later")
        .select("id, person_or_store, currency, amount")
        .eq("is_paid", false);
      if (tabsErr) throw tabsErr;
      const tabIds = (tabs || []).map((t: any) => t.id);
      if (tabIds.length === 0) return { items: [], tabRemaining: new Map<string, number>() };

      const { data: items, error: itemsErr } = await supabase
        .from("pay_later_items")
        .select("*")
        .in("pay_later_id", tabIds)
        .order("purchased_at", { ascending: false });
      if (itemsErr) throw itemsErr;

      const { data: payments, error: paymentsErr } = await supabase
        .from("pay_later_payments")
        .select("pay_later_id, amount")
        .in("pay_later_id", tabIds);
      if (paymentsErr) throw paymentsErr;

      const paidByTab = new Map<string, number>();
      (payments || []).forEach((p: any) => {
        paidByTab.set(p.pay_later_id, (paidByTab.get(p.pay_later_id) || 0) + Number(p.amount));
      });

      const tabById = new Map((tabs || []).map((t: any) => [t.id, t]));
      const tabRemaining = new Map<string, number>();
      (tabs || []).forEach((t: any) => {
        const paid = paidByTab.get(t.id) || 0;
        tabRemaining.set(t.id, Math.max(0, Number(t.amount) - paid));
      });

      const mapped = (items || []).map((item: any) => ({
        ...(item as PayLaterItem),
        person_or_store: tabById.get(item.pay_later_id)?.person_or_store || "",
        currency: tabById.get(item.pay_later_id)?.currency || "LKR",
      }));

      return { items: mapped, tabRemaining };
    },
    enabled: !!user,
  });
}

export function useCreatePayLaterTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tab: { person_or_store: string; currency: string; due_date?: string }) => {
      const { data, error } = await supabase
        .from("pay_later")
        .insert({ ...tab, user_id: user!.id, amount: 0, description: "" } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay-later"] }),
  });
}

export function useAddPurchase() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (item: { pay_later_id: string; description: string; amount: number; category: string; purchased_at: string }) => {
      const { error: itemErr } = await supabase
        .from("pay_later_items")
        .insert({ ...item, user_id: user!.id } as any);
      if (itemErr) throw itemErr;
      // Recalculate tab total
      const { data: items } = await supabase.from("pay_later_items").select("amount").eq("pay_later_id", item.pay_later_id);
      const total = (items || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
      await supabase.from("pay_later").update({ amount: total } as any).eq("id", item.pay_later_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-later"] });
      qc.invalidateQueries({ queryKey: ["pay-later-pending-items"] });
    },
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payment: { pay_later_id: string; amount: number; note?: string; paid_at?: string; account_id?: string; currency?: string; person_or_store?: string }) => {
      // How much was already paid on this tab before this payment — needed to
      // work out exactly which purchases (and which categories) this new
      // payment is actually covering.
      const { data: priorPayments } = await supabase
        .from("pay_later_payments")
        .select("amount")
        .eq("pay_later_id", payment.pay_later_id);
      const paidBefore = (priorPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

      const { error } = await supabase
        .from("pay_later_payments")
        .insert({ pay_later_id: payment.pay_later_id, amount: payment.amount, note: payment.note || "", user_id: user!.id, paid_at: payment.paid_at } as any);
      if (error) throw error;

      // If an account is selected, split the wallet debit into one
      // transaction per category actually being paid off, instead of one
      // lump "Pay Later" transaction — so a payment covering, say, ₨200 of
      // Dry Food and ₨150 of Instant purchases shows as two categorised
      // transactions, not one ₨350 "Pay Later" entry.
      if (payment.account_id) {
        const { data: items } = await supabase
          .from("pay_later_items")
          .select("amount, category, purchased_at, created_at")
          .eq("pay_later_id", payment.pay_later_id)
          // Order by the order they were ADDED (created_at) — not the
          // purchase date, which is user-editable and shouldn't reshuffle
          // the payoff queue. Whatever you logged first gets paid off first.
          .order("created_at", { ascending: true });

        // Walk the items oldest-first as a running number line, and see which
        // slice of it falls within [paidBefore, paidBefore + this payment) —
        // that's the waterfall: earlier purchases get paid off first.
        const rangeStart = paidBefore;
        const rangeEnd = paidBefore + payment.amount;
        const byCategory = new Map<string, number>();
        let cursor = 0;
        for (const item of items || []) {
          const itemStart = cursor;
          const itemEnd = cursor + Number(item.amount);
          cursor = itemEnd;
          const overlapStart = Math.max(itemStart, rangeStart);
          const overlapEnd = Math.min(itemEnd, rangeEnd);
          if (overlapEnd > overlapStart) {
            const portion = overlapEnd - overlapStart;
            byCategory.set(item.category, (byCategory.get(item.category) || 0) + portion);
          }
        }
        // Anything left over (e.g. an overpayment beyond the sum of logged
        // purchases) doesn't belong to any category — keep it honestly
        // labelled rather than attributing it to the wrong one.
        const allocated = Array.from(byCategory.values()).reduce((s, v) => s + v, 0);
        const unattributed = payment.amount - allocated;
        if (unattributed > 0.004) {
          byCategory.set("Pay Later", (byCategory.get("Pay Later") || 0) + unattributed);
        }

        const baseDescription = payment.person_or_store
          ? `Pay Later: ${payment.person_or_store}${payment.note ? ` - ${payment.note}` : ""}`
          : `Pay Later payment${payment.note ? ` - ${payment.note}` : ""}`;

        for (const [category, amount] of byCategory.entries()) {
          if (amount <= 0) continue;
          const { error: txError } = await supabase
            .from("transactions")
            .insert({
              user_id: user!.id,
              account_id: payment.account_id,
              type: "expense",
              amount: Math.round(amount * 100) / 100,
              currency: payment.currency || "LKR",
              category,
              description: baseDescription,
              date: payment.paid_at || toLocalISODate(new Date()),
            });
          if (txError) throw txError;
        }

        // Debit the account balance for the full payment, once.
        const { error: balErr } = await supabase.rpc("update_account_balance", {
          _account_id: payment.account_id,
          _amount: -payment.amount,
        });
        if (balErr) throw balErr;
      }

      // If total payments now cover the tab's total, mark it settled so its
      // purchases stop showing as "pending" on the Transactions page.
      const { data: tab } = await supabase.from("pay_later").select("amount").eq("id", payment.pay_later_id).single();
      const { data: payments } = await supabase.from("pay_later_payments").select("amount").eq("pay_later_id", payment.pay_later_id);
      const totalPaid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      if (tab && totalPaid >= Number((tab as any).amount) && Number((tab as any).amount) > 0) {
        await supabase.from("pay_later").update({ is_paid: true, paid_at: new Date().toISOString() } as any).eq("id", payment.pay_later_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-later"] });
      qc.invalidateQueries({ queryKey: ["pay-later-pending-items"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useEditPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: { id: string; amount: number; note?: string; paid_at?: string; old_amount: number; account_id?: string }) => {
      const { error } = await supabase
        .from("pay_later_payments")
        .update({ amount: payment.amount, note: payment.note || "", paid_at: payment.paid_at } as any)
        .eq("id", payment.id);
      if (error) throw error;

      // If there was an account linked, adjust the balance difference
      if (payment.account_id) {
        const diff = payment.old_amount - payment.amount; // positive = refund, negative = more debit
        if (diff !== 0) {
          const { error: balErr } = await supabase.rpc("update_account_balance", {
            _account_id: payment.account_id,
            _amount: diff,
          });
          if (balErr) throw balErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-later"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: { id: string; pay_later_id: string; amount: number; account_id?: string }) => {
      const { error } = await supabase.from("pay_later_payments").delete().eq("id", payment.id);
      if (error) throw error;

      // If account was linked, reverse the debit (refund the wallet)
      if (payment.account_id) {
        const { error: balErr } = await supabase.rpc("update_account_balance", {
          _account_id: payment.account_id,
          _amount: payment.amount,
        });
        if (balErr) throw balErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-later"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useMarkTabSettled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pay_later")
        .update({ is_paid: true, paid_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-later"] });
      qc.invalidateQueries({ queryKey: ["pay-later-pending-items"] });
    },
  });
}

export function useDeletePayLaterTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pay_later").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay-later"] }),
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pay_later_id }: { id: string; pay_later_id: string }) => {
      const { error } = await supabase.from("pay_later_items").delete().eq("id", id);
      if (error) throw error;
      // Recalculate total
      const { data: items } = await supabase.from("pay_later_items").select("amount").eq("pay_later_id", pay_later_id);
      const total = (items || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
      await supabase.from("pay_later").update({ amount: total } as any).eq("id", pay_later_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-later"] });
      qc.invalidateQueries({ queryKey: ["pay-later-pending-items"] });
    },
  });
}
