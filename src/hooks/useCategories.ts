import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CategoryKind = "income" | "expense" | "both";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  color: string;
  kind: CategoryKind;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_CATEGORIES: { name: string; icon: string; kind: CategoryKind; subcategories: string[] }[] = [
  { name: "Food", icon: "UtensilsCrossed", kind: "expense", subcategories: ["Dry", "Instant", "Alcohol", "Snacks", "Beverages"] },
  { name: "Transport", icon: "Car", kind: "expense", subcategories: ["Fuel", "Public", "Taxi", "Parking"] },
  { name: "Shopping", icon: "ShoppingBag", kind: "expense", subcategories: ["Clothing", "Electronics", "Household"] },
  { name: "Utilities", icon: "Zap", kind: "expense", subcategories: ["Electricity", "Water", "Internet", "Phone"] },
  { name: "Health", icon: "Heart", kind: "expense", subcategories: ["Medicine", "Doctor", "Gym"] },
  { name: "Entertainment", icon: "Gamepad2", kind: "expense", subcategories: ["Movies", "Games", "Subscriptions"] },
  { name: "Salary", icon: "Banknote", kind: "income", subcategories: [] },
  { name: "Freelance", icon: "Laptop", kind: "income", subcategories: [] },
  { name: "Investment Income", icon: "TrendingUp", kind: "income", subcategories: ["Dividends", "Interest", "Capital Gains"] },
  { name: "Gifts Received", icon: "Gift", kind: "income", subcategories: [] },
  { name: "Refunds", icon: "Undo2", kind: "income", subcategories: [] },
  { name: "Transfer", icon: "ArrowRightLeft", kind: "both", subcategories: [] },
  { name: "Other", icon: "Tag", kind: "both", subcategories: [] },
];

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories" as any)
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      const categories = data as unknown as Category[];
      
      // Seed defaults if empty
      if (categories.length === 0 && user) {
        const inserts: any[] = [];
        DEFAULT_CATEGORIES.forEach((cat, i) => {
          const parentId = crypto.randomUUID();
          inserts.push({
            id: parentId,
            user_id: user.id,
            name: cat.name,
            parent_id: null,
            icon: cat.icon,
            kind: cat.kind,
            sort_order: i,
            is_default: true,
          });
          cat.subcategories.forEach((sub, j) => {
            inserts.push({
              user_id: user.id,
              name: sub,
              parent_id: parentId,
              icon: "Tag",
              kind: cat.kind,
              sort_order: j,
              is_default: true,
            });
          });
        });
        const { data: seeded, error: seedErr } = await supabase
          .from("categories" as any)
          .insert(inserts as any)
          .select();
        if (seedErr) throw seedErr;
        return seeded as unknown as Category[];
      }
      return categories;
    },
    enabled: !!user,
  });
}

/** Returns top-level categories only */
export function useParentCategories() {
  const { data: all = [] } = useCategories();
  return all.filter(c => !c.parent_id);
}

/** Returns subcategories for a given parent */
export function useSubcategories(parentId: string | null) {
  const { data: all = [] } = useCategories();
  if (!parentId) return [];
  return all.filter(c => c.parent_id === parentId);
}

/** Get flat list of category names for backward compatibility */
export function useCategoryNames() {
  const { data: all = [] } = useCategories();
  const parents = all.filter(c => !c.parent_id);
  const names: string[] = [];
  parents.forEach(p => {
    names.push(p.name);
    const subs = all.filter(c => c.parent_id === p.id);
    subs.forEach(s => names.push(`${p.name} > ${s.name}`));
  });
  return { parentCategories: parents, allNames: names, allCategories: all };
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (cat: { name: string; parent_id?: string | null; icon?: string; color?: string; kind?: CategoryKind }) => {
      const { data, error } = await supabase
        .from("categories" as any)
        .insert({
          user_id: user!.id,
          name: cat.name,
          parent_id: cat.parent_id || null,
          icon: cat.icon || "Tag",
          color: cat.color || "primary",
          kind: cat.kind || "expense",
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; icon?: string; color?: string; sort_order?: number; kind?: CategoryKind }) => {
      const { error } = await supabase
        .from("categories" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categories" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
