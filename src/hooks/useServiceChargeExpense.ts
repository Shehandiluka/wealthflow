import { supabase } from "@/integrations/supabase/client";
import { useCategories, useCreateCategory, Category } from "@/hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook that provides a function to record a service charge as an expense
 * under "Utilities > Bank Transfer". Auto-creates the subcategory if missing.
 */
export function useServiceChargeExpense() {
  const { user } = useAuth();
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const qc = useQueryClient();

  const recordServiceCharge = async ({
    amount,
    currency,
    accountId,
    date,
    description,
  }: {
    amount: number;
    currency: string;
    accountId: string;
    date: string;
    description?: string;
  }) => {
    if (!user || amount <= 0) return;

    // Find or create "Utilities > Bank Transfer"
    const utilitiesParent = categories.find(
      (c) => !c.parent_id && c.name === "Utilities"
    );

    let categoryName = "Utilities > Bank Transfer";

    if (utilitiesParent) {
      const bankTransferSub = categories.find(
        (c) => c.parent_id === utilitiesParent.id && c.name === "Bank Transfer"
      );
      if (!bankTransferSub) {
        await createCategory.mutateAsync({
          name: "Bank Transfer",
          parent_id: utilitiesParent.id,
          icon: "ArrowRightLeft",
        });
      }
    } else {
      // No Utilities parent – just use "Bank Transfer" as category name
      categoryName = "Bank Transfer";
    }

    // Create expense transaction for the service charge
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: accountId,
      type: "expense",
      amount,
      currency,
      category: categoryName,
      description: description || "Service charge",
      date,
    });
    if (error) throw error;

    // Deduct from account balance
    await supabase.rpc("update_account_balance", {
      _account_id: accountId,
      _amount: -amount,
    });

    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return { recordServiceCharge };
}
