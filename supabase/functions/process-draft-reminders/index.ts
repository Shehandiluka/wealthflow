import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Current wall-clock parts in a given IANA timezone */
function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dow: dowMap[parts.weekday as string] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function categoryFromMessage(message: string): string | null {
  return message.match(/\[([^\[\]]+)\]\s*$/)?.[1] ?? null;
}

function cleanDescription(message: string): string {
  return (
    message
      .replace(/\s*\[[^\[\]]+\]\s*$/, "")
      .replace(
        /(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪|₨)?\s*\b[0-9][0-9,]*(?:\.[0-9]{1,2})?\b\s*(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪|₨)?/i,
        " ",
      )
      .replace(/^\s*(for|on|to)\b/i, "")
      .replace(/\s+/g, " ")
      .trim() || message.slice(0, 120)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const summary: Array<Record<string, unknown>> = [];

  try {
    const { data: settings, error } = await admin
      .from("draft_reminder_settings")
      .select("*")
      .eq("enabled", true);
    if (error) throw error;

    for (const s of settings ?? []) {
      let tzParts;
      try {
        tzParts = zonedParts(now, s.timezone);
      } catch {
        tzParts = zonedParts(now, "UTC");
      }
      const [hh, mm] = String(s.cutoff_time).split(":");
      const cutoffMinutes = Number(hh) * 60 + Number(mm);

      const isCutoffDay = tzParts.dow === s.cutoff_dow;
      const reachedCutoff = isCutoffDay && tzParts.minutes >= cutoffMinutes;
      const alreadyRan =
        s.last_run_at && now.getTime() - new Date(s.last_run_at).getTime() < 20 * 60 * 60 * 1000;

      if (!reachedCutoff || alreadyRan) continue;

      let posted = 0;
      let skipped = 0;

      if (s.auto_post) {
        const { data: drafts } = await admin
          .from("sms_imports")
          .select("*")
          .eq("user_id", s.user_id)
          .eq("auto_post", true)
          .is("transaction_id", null);

        const { data: accounts } = await admin
          .from("accounts")
          .select("id, name, currency")
          .eq("user_id", s.user_id);

        for (const d of drafts ?? []) {
          const amount = Number(d.parsed_amount);
          if (!amount || !accounts?.length) {
            skipped++;
            continue;
          }
          const account =
            accounts.find((a) => a.id === d.suggested_account_id) ??
            accounts.find(
              (a) =>
                d.parsed_account_ref &&
                a.name.toLowerCase().includes(String(d.parsed_account_ref).toLowerCase()),
            ) ??
            accounts[0];

          const type = d.parsed_type === "income" ? "income" : "expense";
          const category =
            d.suggested_category ??
            categoryFromMessage(d.message) ??
            (type === "income" ? "Other Income" : "Other");

          const { data: tx, error: txErr } = await admin
            .from("transactions")
            .insert({
              user_id: s.user_id,
              account_id: account.id,
              type,
              amount,
              currency: account.currency,
              category,
              description: cleanDescription(d.message),
              date: (d.parsed_date ?? d.received_at).slice(0, 10),
            })
            .select()
            .single();

          if (txErr || !tx) {
            await admin
              .from("sms_imports")
              .update({ status: "error", error: txErr?.message ?? "Auto-post failed" })
              .eq("id", d.id);
            skipped++;
            continue;
          }

          await admin.rpc("update_account_balance", {
            _account_id: account.id,
            _amount: type === "income" ? amount : -amount,
          });

          // Draft posted successfully — remove it from the inbox
          await admin.from("sms_imports").delete().eq("id", d.id);
          posted++;
        }
      }

      await admin
        .from("draft_reminder_settings")
        .update({ last_run_at: now.toISOString() })
        .eq("id", s.id);

      summary.push({ user_id: s.user_id, posted, skipped });
    }

    return new Response(JSON.stringify({ ok: true, processed: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-draft-reminders error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
