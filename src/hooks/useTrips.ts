import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  trip_currency: string;
  budget: number;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripPlannedExpense {
  id: string;
  trip_id: string;
  user_id: string;
  category: string;
  description: string;
  planned_amount: number;
  currency: string;
  day_number: number | null;
  created_at: string;
  updated_at: string;
}

export function useTrips() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trips", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips" as any)
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Trip[];
    },
    enabled: !!user,
  });
}

export function useTrip(tripId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips" as any)
        .select("*")
        .eq("id", tripId!)
        .single();
      if (error) throw error;
      return data as unknown as Trip;
    },
    enabled: !!user && !!tripId,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (trip: Omit<Trip, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("trips" as any)
        .insert({ ...trip, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Trip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Trip> & { id: string }) => {
      const { error } = await supabase
        .from("trips" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useTripPlannedExpenses(tripId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trip-planned-expenses", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_planned_expenses" as any)
        .select("*")
        .eq("trip_id", tripId!)
        .order("day_number", { ascending: true });
      if (error) throw error;
      return data as unknown as TripPlannedExpense[];
    },
    enabled: !!user && !!tripId,
  });
}

export function useCreatePlannedExpense() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (expense: Omit<TripPlannedExpense, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("trip_planned_expenses" as any)
        .insert({ ...expense, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["trip-planned-expenses", vars.trip_id] }),
  });
}

export function useDeletePlannedExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripId }: { id: string; tripId: string }) => {
      const { error } = await supabase.from("trip_planned_expenses" as any).delete().eq("id", id);
      if (error) throw error;
      return tripId;
    },
    onSuccess: (tripId) => qc.invalidateQueries({ queryKey: ["trip-planned-expenses", tripId] }),
  });
}

export function useTripTransactions(tripId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trip-transactions", tripId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("transactions")
        .select("*") as any)
        .eq("trip_id", tripId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!tripId,
  });
}
