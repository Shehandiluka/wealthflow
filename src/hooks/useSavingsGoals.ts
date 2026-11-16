import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type SavingsGoal = Tables<"savings_goals">;
export type GoalContribution = Tables<"savings_goal_contributions">;

export const GOAL_CATEGORIES = [
  { value: "tax", label: "Tax" },
  { value: "land", label: "Land" },
  { value: "vehicle", label: "Vehicle" },
  { value: "emergency", label: "Emergency Fund" },
  { value: "travel", label: "Travel" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const;

const AVG_DAYS_PER_MONTH = 30.44;

export interface GoalPace {
  remaining: number;
  monthsLeft: number | null; // null = open-ended, no deadline
  monthlyRequired: number | null;
  percentComplete: number;
  isComplete: boolean;
  isOverdue: boolean;
  status: "complete" | "overdue" | "behind" | "on-track" | "ahead" | "open-ended";
}

/**
 * How much per month is needed to hit the goal by its target date, and whether
 * the current pace of saving is realistically on track for that — comparing
 * how much *should* have been saved by now (a straight line from start to
 * target) against what's actually been saved.
 */
export function computeGoalPace(goal: SavingsGoal): GoalPace {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const isComplete = goal.current_amount >= goal.target_amount && goal.target_amount > 0;
  const percentComplete = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;

  if (!goal.target_date) {
    return { remaining, monthsLeft: null, monthlyRequired: null, percentComplete, isComplete, isOverdue: false, status: isComplete ? "complete" : "open-ended" };
  }

  const now = new Date();
  const start = new Date(goal.start_date);
  const target = new Date(goal.target_date);
  const daysLeft = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  const isOverdue = daysLeft < 0 && !isComplete;

  if (isComplete) {
    return { remaining: 0, monthsLeft: 0, monthlyRequired: 0, percentComplete: 100, isComplete: true, isOverdue: false, status: "complete" };
  }
  if (isOverdue) {
    return { remaining, monthsLeft: 0, monthlyRequired: remaining, percentComplete, isComplete: false, isOverdue: true, status: "overdue" };
  }

  const monthsLeft = Math.max(daysLeft / AVG_DAYS_PER_MONTH, 1 / AVG_DAYS_PER_MONTH); // never divide by 0
  const monthlyRequired = remaining / monthsLeft;

  // Expected progress if saving in a straight line from start_date to target_date
  const totalDays = Math.max(1, (target.getTime() - start.getTime()) / 86400000);
  const elapsedDays = Math.max(0, (now.getTime() - start.getTime()) / 86400000);
  const expectedFraction = Math.min(1, elapsedDays / totalDays);
  const expectedAmount = goal.target_amount * expectedFraction;

  let status: GoalPace["status"] = "on-track";
  if (goal.current_amount < expectedAmount * 0.9) status = "behind";
  else if (goal.current_amount > expectedAmount * 1.1) status = "ahead";

  return { remaining, monthsLeft, monthlyRequired, percentComplete, isComplete: false, isOverdue: false, status };
}

export function useSavingsGoals(includeArchived = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["savings_goals", user?.id, includeArchived],
    queryFn: async () => {
      let query = supabase.from("savings_goals").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: true });
      if (!includeArchived) query = query.eq("is_archived", false);
      const { data, error } = await query;
      if (error) throw error;
      return data as SavingsGoal[];
    },
    enabled: !!user,
  });
}

export function useGoalContributions(goalId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["savings_goal_contributions", goalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_goal_contributions")
        .select("*")
        .eq("goal_id", goalId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as GoalContribution[];
    },
    enabled: !!user && !!goalId,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (goal: Omit<TablesInsert<"savings_goals">, "user_id">) => {
      const { data, error } = await supabase
        .from("savings_goals")
        .insert({ ...goal, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings_goals"] }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SavingsGoal> }) => {
      const { error } = await supabase.from("savings_goals").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings_goals"] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // savings_goal_contributions cascade-delete automatically (ON DELETE CASCADE)
      const { error } = await supabase.from("savings_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_goals"] });
      qc.invalidateQueries({ queryKey: ["savings_goal_contributions"] });
    },
  });
}

async function updateBalance(accountId: string, amount: number) {
  const { error } = await supabase.rpc("update_account_balance", { _account_id: accountId, _amount: amount });
  if (error) throw error;
}

async function updateGoalProgress(goalId: string, amount: number) {
  const { error } = await supabase.rpc("update_goal_progress", { _goal_id: goalId, _amount: amount });
  if (error) throw error;
}

interface AddContributionInput {
  goal_id: string;
  amount: number;
  account_id?: string | null; // if set, pulls the money from this wallet
  date: string;
  note?: string;
}

export function useAddContribution() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: AddContributionInput) => {
      const { data, error } = await supabase
        .from("savings_goal_contributions")
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      await updateGoalProgress(input.goal_id, input.amount);
      if (input.account_id) {
        await updateBalance(input.account_id, -input.amount);
      }
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["savings_goals"] });
      qc.invalidateQueries({ queryKey: ["savings_goal_contributions", vars.goal_id] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contribution: GoalContribution) => {
      const { error } = await supabase.from("savings_goal_contributions").delete().eq("id", contribution.id);
      if (error) throw error;

      await updateGoalProgress(contribution.goal_id, -contribution.amount);
      if (contribution.account_id) {
        await updateBalance(contribution.account_id, contribution.amount);
      }
    },
    onSuccess: (_, contribution) => {
      qc.invalidateQueries({ queryKey: ["savings_goals"] });
      qc.invalidateQueries({ queryKey: ["savings_goal_contributions", contribution.goal_id] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
