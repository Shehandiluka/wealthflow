import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SmsImport {
  id: string;
  user_id: string;
  sender: string;
  message: string;
  received_at: string;
  parsed_amount: number | null;
  parsed_type: "income" | "expense" | null;
  parsed_account_ref: string | null;
  parsed_balance: number | null;
  parsed_date: string | null;
  suggested_account_id?: string | null;
  suggested_category?: string | null;
  transaction_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export interface SmsApiKey {
  id: string;
  user_id: string;
  key_prefix: string;
  label: string;
  default_account_id: string | null;
  created_at: string;
  last_used_at: string | null;
}

export function useSmsImports() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sms_imports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_imports")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as SmsImport[];
    },
    enabled: !!user,
  });
}

export function useSmsApiKeys() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sms_api_keys", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_api_keys")
        .select("id, user_id, key_prefix, label, default_account_id, created_at, last_used_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SmsApiKey[];
    },
    enabled: !!user,
  });
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "sk_sms_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useCreateSmsApiKey() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (opts: { label?: string; default_account_id?: string | null }) => {
      const key = randomKey();
      const key_hash = await sha256Hex(key);
      const key_prefix = key.slice(0, 14);
      const { error } = await supabase.from("sms_api_keys").insert({
        user_id: user!.id,
        key_hash,
        key_prefix,
        label: opts.label ?? "Apple Shortcut",
        default_account_id: opts.default_account_id ?? null,
      });
      if (error) throw error;
      return key; // plaintext returned ONCE to the caller
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms_api_keys"] }),
  });
}

export function useDeleteSmsApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sms_api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms_api_keys"] }),
  });
}

export function useDeleteSmsImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sms_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms_imports"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useSetDraftCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string | null }) => {
      const { error } = await supabase
        .from("sms_imports")
        .update({ suggested_category: category })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms_imports"] }),
  });
}

