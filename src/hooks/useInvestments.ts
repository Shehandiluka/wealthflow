import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Investment = Tables<"investments">;
export type InvestmentType = Tables<"investment_types">;
export type InvestmentContribution = Tables<"investment_contributions">;

export const BUILT_IN_INVESTMENT_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "gold", label: "Gold" },
  { value: "fixed_deposit", label: "Fixed Deposit" },
];

export function useInvestments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Investment[];
    },
    enabled: !!user,
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (inv: Omit<TablesInsert<"investments">, "user_id">) => {
      const { data, error } = await supabase
        .from("investments")
        .insert({ ...inv, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investments"] }),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // investment_contributions rows cascade-delete automatically (ON DELETE CASCADE)
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment_contributions"] });
    },
  });
}

/* ---------------- Investment types ---------------- */

export function useInvestmentTypes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["investment_types", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_types")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as InvestmentType[];
    },
    enabled: !!user,
  });
}

export function useCreateInvestmentType() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("investment_types")
        .insert({ name: name.trim(), user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investment_types"] }),
  });
}

export function useDeleteInvestmentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investment_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investment_types"] }),
  });
}

/* ---------------- Contributions (invest again) ---------------- */

export function useContributions(investmentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["investment_contributions", investmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_contributions")
        .select("*")
        .eq("investment_id", investmentId!)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InvestmentContribution[];
    },
    enabled: !!user && !!investmentId,
  });
}

interface AddContributionInput {
  investment: Investment;
  amount: number;
  valueChange: number;
  accountId?: string | null;
  note?: string;
  date: string;
}

export function useAddContribution() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ investment, amount, valueChange, accountId, note, date }: AddContributionInput) => {
      const { error: cErr } = await supabase.from("investment_contributions").insert({
        user_id: user!.id,
        investment_id: investment.id,
        amount,
        value_change: valueChange,
        account_id: accountId || null,
        note: note || "",
        date,
      });
      if (cErr) throw cErr;

      const { error: uErr } = await supabase
        .from("investments")
        .update({
          invested: Number(investment.invested) + amount,
          value: Number(investment.value) + valueChange,
        })
        .eq("id", investment.id);
      if (uErr) throw uErr;

      // Deduct the money from the selected wallet and log it as an expense
      if (accountId && amount > 0) {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: user!.id,
          account_id: accountId,
          type: "expense",
          amount,
          currency: investment.currency,
          category: "Investment",
          description: note || `Investment — ${investment.name}`,
          date,
        });
        if (txErr) throw txErr;
        const { error: bErr } = await supabase.rpc("update_account_balance", {
          _account_id: accountId,
          _amount: -amount,
        });
        if (bErr) throw bErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      qc.invalidateQueries({ queryKey: ["investment_contributions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
