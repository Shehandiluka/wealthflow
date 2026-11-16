// Sends a push notification for every debt due within REMINDER_WINDOW_DAYS, once per
// day per debt (tracked via debt_reminder_log so a cron running every hour doesn't spam).
// Intended to be invoked on a schedule — see README.md "Push notifications" section for
// the one-time pg_cron setup.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REMINDER_WINDOW_DAYS = 3; // remind starting 3 days out, plus the due day itself

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

function nextDueInfo(dueDay: number): { daysUntil: number } {
  const now = new Date();
  const day = Math.min(Math.max(dueDay || 1, 1), 28);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let due = new Date(now.getFullYear(), now.getMonth(), day);
  if (due < today) due = new Date(now.getFullYear(), now.getMonth() + 1, day);
  const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
  return { daysUntil };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // This function has no JWT check (it's invoked by a cron job, not a signed-in user),
  // so gate it with a shared secret instead — anyone with the URL could otherwise
  // trigger it repeatedly.
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
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

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: debts, error: debtsErr } = await admin
      .from("debts")
      .select("id, user_id, name, remaining_amount, currency, due_date")
      .gt("remaining_amount", 0);
    if (debtsErr) throw debtsErr;

    const today = new Date().toISOString().split("T")[0];
    let sent = 0;
    let skipped = 0;

    for (const debt of debts ?? []) {
      const { daysUntil } = nextDueInfo(debt.due_date);
      if (daysUntil > REMINDER_WINDOW_DAYS || daysUntil < 0) continue;

      // Already reminded today for this debt?
      const { data: already } = await admin
        .from("debt_reminder_log")
        .select("id")
        .eq("debt_id", debt.id)
        .eq("reminded_on", today)
        .maybeSingle();
      if (already) { skipped++; continue; }

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", debt.user_id);
      if (!subs || subs.length === 0) continue;

      const body =
        daysUntil === 0
          ? `${debt.name} is due today (${debt.currency} ${debt.remaining_amount}).`
          : `${debt.name} is due in ${daysUntil} day${daysUntil === 1 ? "" : "s"} (${debt.currency} ${debt.remaining_amount}).`;

      const payload = JSON.stringify({
        title: "Loan payment coming up",
        body,
        url: "/debts",
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
          // 410/404 means the browser revoked this subscription — clean it up so we
          // don't keep failing on it every run.
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }

      await admin.from("debt_reminder_log").insert({ debt_id: debt.id, reminded_on: today });
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-debt-reminders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
