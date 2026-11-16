import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split("T")[0];

    // Get all active recurring transactions due today or earlier
    const { data: dueItems, error: fetchError } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("is_active", true)
      .lte("next_due", today);

    if (fetchError) throw fetchError;
    if (!dueItems || dueItems.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const item of dueItems) {
      // Create the transaction
      const { error: insertError } = await supabase
        .from("transactions")
        .insert({
          user_id: item.user_id,
          account_id: item.account_id,
          to_account_id: item.to_account_id,
          type: item.type,
          amount: item.amount,
          currency: item.currency,
          category: item.category,
          description: `${item.description} (auto)`,
          date: today,
          debt_id: item.debt_id ?? null,
        });

      if (insertError) {
        console.error(`Failed to create transaction for recurring ${item.id}:`, insertError);
        continue;
      }

      // Update account balance
      const sign = item.type === "income" ? 1 : -1;
      await supabase.rpc("update_account_balance", {
        _account_id: item.account_id,
        _amount: item.amount * sign,
      });

      if (item.type === "transfer" && item.to_account_id) {
        await supabase.rpc("update_account_balance", {
          _account_id: item.to_account_id,
          _amount: item.amount,
        });
      }

      // Deduct from linked debt's remaining balance
      if (item.type === "expense" && item.debt_id) {
        await supabase.rpc("update_debt_remaining", {
          _debt_id: item.debt_id,
          _amount: -item.amount,
        });
      }

      // Calculate next due date
      const nextDue = new Date(item.next_due);
      switch (item.frequency) {
        case "daily":
          nextDue.setDate(nextDue.getDate() + 1);
          break;
        case "weekly":
          nextDue.setDate(nextDue.getDate() + 7);
          break;
        case "monthly":
          nextDue.setMonth(nextDue.getMonth() + 1);
          break;
        case "yearly":
          nextDue.setFullYear(nextDue.getFullYear() + 1);
          break;
      }

      await supabase
        .from("recurring_transactions")
        .update({ next_due: nextDue.toISOString().split("T")[0] })
        .eq("id", item.id);

      processed++;
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing recurring transactions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
