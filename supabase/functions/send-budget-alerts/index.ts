// Sends a push notification the first time a budget crosses 80% or 100% of its
// monthly limit, once per threshold per budget per month (tracked via
// budget_alert_log). Run on a schedule — see supabase/cron-debt-reminders-template.sql
// for how to add this alongside the debt reminders cron entry.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  webpush.setVapidDetails("mailto:noreply@wealthflow.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    const monthStart = `${month}-01`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.toISOString().slice(0, 7);
    const prevMonthStart = `${prevMonth}-01`;

    const { data: budgets, error: budgetsErr } = await admin
      .from("budgets")
      .select("id, user_id, category, monthly_limit, currency, rollover");
    if (budgetsErr) throw budgetsErr;

    const { data: transactions, error: txErr } = await admin
      .from("transactions")
      .select("user_id, category, currency, amount, date")
      .eq("type", "expense")
      .gte("date", prevMonthStart);
    if (txErr) throw txErr;

    // Spend grouped by user + category + currency, separately for this month
    // and last month (last month's is only needed for rollover budgets).
    const spendByKey = new Map<string, number>();
    const prevSpendByKey = new Map<string, number>();
    for (const tx of transactions ?? []) {
      const key = `${tx.user_id}::${tx.category}::${tx.currency}`;
      if (tx.date >= monthStart) {
        spendByKey.set(key, (spendByKey.get(key) ?? 0) + Number(tx.amount));
      } else {
        prevSpendByKey.set(key, (prevSpendByKey.get(key) ?? 0) + Number(tx.amount));
      }
    }

    let sent = 0;

    for (const budget of budgets ?? []) {
      const spent = spendByKey.get(`${budget.user_id}::${budget.category}::${budget.currency}`) ?? 0;
      let limit = Number(budget.monthly_limit);
      if (budget.rollover) {
        const prevSpent = prevSpendByKey.get(`${budget.user_id}::${budget.category}::${budget.currency}`) ?? 0;
        limit += Math.max(0, Number(budget.monthly_limit) - prevSpent);
      }
      if (limit <= 0) continue;
      const pct = (spent / limit) * 100;

      const threshold = pct >= 100 ? "100" : pct >= 80 ? "80" : null;
      if (!threshold) continue;

      const { data: already } = await admin
        .from("budget_alert_log")
        .select("id")
        .eq("budget_id", budget.id)
        .eq("month", month)
        .eq("threshold", threshold)
        .maybeSingle();
      if (already) continue;

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", budget.user_id);
      if (!subs || subs.length === 0) continue;

      const body =
        threshold === "100"
          ? `You've gone over budget on ${budget.category} this month (${budget.currency} ${spent.toFixed(0)} of ${limit.toFixed(0)}).`
          : `${budget.category} is at ${pct.toFixed(0)}% of this month's budget (${budget.currency} ${spent.toFixed(0)} of ${limit.toFixed(0)}).`;

      const payload = JSON.stringify({
        title: threshold === "100" ? "Over budget" : "Budget getting close",
        body,
        url: "/budgets",
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sent++;
        } catch (err) {
          console.error("push failed, dropping stale subscription", sub.id, err);
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }

      await admin.from("budget_alert_log").insert({ budget_id: budget.id, month, threshold });
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-budget-alerts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
