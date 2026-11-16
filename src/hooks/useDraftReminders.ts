import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DraftReminderSettings {
  id: string;
  user_id: string;
  enabled: boolean;
  cutoff_dow: number;
  cutoff_time: string;
  timezone: string;
  auto_post: boolean;
  reminder_lead_hours: number;
  last_run_at: string | null;
}

export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function useDraftReminderSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["draft_reminder_settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draft_reminder_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data as DraftReminderSettings) ?? null;
    },
    enabled: !!user,
  });
}

export function useSaveDraftReminderSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Partial<DraftReminderSettings>) => {
      const { data, error } = await supabase
        .from("draft_reminder_settings")
        .upsert(
          { user_id: user!.id, ...values },
          { onConflict: "user_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as DraftReminderSettings;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["draft_reminder_settings"] }),
  });
}

export function useSetDraftAutoPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, auto_post }: { id: string; auto_post: boolean }) => {
      const { error } = await supabase
        .from("sms_imports")
        .update({ auto_post })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms_imports"] }),
  });
}

/** Next cutoff moment (approximate, uses local browser time) */
export function nextCutoff(settings: DraftReminderSettings | null): Date | null {
  if (!settings) return null;
  const [hh, mm] = settings.cutoff_time.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  const diffDays = (settings.cutoff_dow - now.getDay() + 7) % 7;
  target.setDate(now.getDate() + diffDays);
  if (target <= now) target.setDate(target.getDate() + 7);
  return target;
}
