import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type ParseResult = {
  amount: number | null;
  type: "income" | "expense" | null;
  accountRef: string | null;
  balance: number | null;
  date: string | null;
};

function parseSms(message: string, receivedAt?: string): ParseResult {
  const msg = message.replace(/\s+/g, " ").trim();
  const lower = msg.toLowerCase();

  // Type — broader keyword set covering FriMi / generic bank phrasings.
  const debitWords =
    /(debited|debit|spent|purchase|withdrawn|paid|deducted|sent|charged|bill payment|fund transfer|transfer(?:red)? to|performed on your|round up|atm withdrawal|pos)/i;
  const creditWords =
    /(credited|credit|received|deposited|refund|cashback|salary|inward|reversal)/i;

  let type: "income" | "expense" | null = null;
  if (debitWords.test(lower)) type = "expense";
  else if (creditWords.test(lower)) type = "income";

  // Amount — first currency-like number, optionally preceded by a currency token.
  const amountRegex =
    /(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|\$|€|£|₹|₪)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;
  const amountMatch = msg.match(amountRegex);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;

  // Available balance
  const balRegex =
    /(?:avl|available|bal(?:ance)?)\b[^\d]{0,20}(?:LKR|Rs\.?|INR|USD|EUR|GBP|\$|€|£|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;
  const balMatch = msg.match(balRegex);
  const balance = balMatch ? Number(balMatch[1].replace(/,/g, "")) : null;

  // Account reference — try a few patterns in order
  let accountRef: string | null = null;
  // FriMi ID 2222***160
  const frimi = msg.match(/FriMi\s+ID\s+([\dxX*]+)/i);
  if (frimi) accountRef = frimi[1].replace(/[xX*]/g, "X");
  // generic "A/c", "acct", "account", "card ending"
  if (!accountRef) {
    const m = msg.match(
      /(?:a\/?c|acct|account|card(?:\s+ending)?)\s*(?:no\.?\s*)?[xX*]{0,}\s*([xX*\d]{3,})/i,
    );
    if (m) accountRef = m[1].replace(/[xX*]/g, "X");
  }
  // bare masked-account token like 2050XXXXX860 or 8007XXX247 or 2002*****045
  if (!accountRef) {
    const m = msg.match(/\b(\d{3,5}[xX*]{2,}\d{2,5})\b/);
    if (m) accountRef = m[1].replace(/[xX*]/g, "X");
  }

  // Date — supports "06/11/2026 13:27:46" (DD/MM) and FriMi's
  // "10/14/2026 08:54:25" (MM/DD). When both readings are valid we pick the
  // one closest to when the SMS arrived, so 11/09 on 9 Nov reads as 9 Nov.
  const dateRegex =
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/;
  const dm = msg.match(dateRegex);
  let date: string | null = null;
  if (dm) {
    const a = Number(dm[1]);
    const b = Number(dm[2]);
    let y = dm[3];
    if (y.length === 2) y = "20" + y;
    const hh = (dm[4] ?? "00").padStart(2, "0");
    const mi = dm[5] ?? "00";
    const build = (day: number, month: number) =>
      day >= 1 && day <= 31 && month >= 1 && month <= 12
        ? `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hh}:${mi}:00Z`
        : null;
    const dmy = build(a, b); // DD/MM/YYYY
    const mdy = build(b, a); // MM/DD/YYYY
    if (dmy && mdy && dmy !== mdy) {
      const ref = Date.parse(receivedAt ?? "") || Date.now();
      const dist = (iso: string) => Math.abs(Date.parse(iso) - ref);
      date = dist(mdy) < dist(dmy) ? mdy : dmy;
    } else {
      date = dmy ?? mdy;
    }
  }

  return { amount, type, accountRef, balance, date };
}

/** Freeform quick note, e.g. "500 LKR dry food" or "got 2000 refund". */
function parseNote(text: string): ParseResult {
  const msg = text.replace(/\s+/g, " ").trim();
  const lower = msg.toLowerCase();

  const incomeWords =
    /\b(received|refund|salary|income|got paid|earned|credited|bonus|cashback)\b/i;
  const type: "income" | "expense" = incomeWords.test(lower) ? "income" : "expense";

  // Amount: currency-prefixed, currency-suffixed, or the first bare number.
  const m =
    msg.match(
      /(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
    ) ??
    msg.match(
      /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:LKR|Rs\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\$|€|£|₹|₪)/i,
    ) ??
    msg.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);

  const amount = m ? Number(m[1].replace(/,/g, "")) : null;

  return { amount, type, accountRef: null, balance: null, date: null };
}

async function aiParseSms(message: string, sender: string): Promise<ParseResult | null> {

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return null;
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You extract structured transaction data from bank SMS messages. Reply with ONLY a JSON object — no prose, no markdown — with keys: amount (number or null), type ('income'|'expense'|null — income for credits/deposits/refunds, expense for debits/spend/withdrawals), accountRef (string or null, last-4 of account/card if present), balance (number or null, post-transaction available balance), date (ISO 8601 string or null)." },
          { role: "user", content: `Sender: ${sender}\nMessage: ${message}` },
        ],
      }),
    });
    if (!resp.ok) { console.error("AI parse failed", resp.status, await resp.text()); return null; }
    const json = await resp.json();
    let content: string = json?.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(content.slice(start, end + 1));
    return {
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      type: parsed.type === "income" || parsed.type === "expense" ? parsed.type : null,
      accountRef: typeof parsed.accountRef === "string" ? parsed.accountRef : null,
      balance: typeof parsed.balance === "number" ? parsed.balance : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
    };
  } catch (e) { console.error("AI parse error", e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // API key from header or query (?api_key=) for Shortcut convenience
    const url = new URL(req.url);
    const apiKey =
      req.headers.get("x-api-key") ||
      req.headers.get("X-Api-Key") ||
      url.searchParams.get("api_key");

    if (!apiKey || apiKey.length < 16) {
      return new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const keyHash = await sha256(apiKey);
    const { data: keyRow, error: keyErr } = await admin
      .from("sms_api_keys")
      .select("id, user_id, default_account_id")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (keyErr || !keyRow) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isNote =
      String(body.source ?? "").toLowerCase() === "note" ||
      body.note === true;

    const sender =
      String(body.sender ?? (isNote ? "Quick Note" : "Unknown")).slice(0, 200).trim() ||
      (isNote ? "Quick Note" : "Unknown");
    const message = String(body.message ?? "").slice(0, 4000).trim();
    const receivedAt =
      typeof body.receivedAt === "string" ? body.receivedAt : new Date().toISOString();

    if (!message) {
      return new Response(
        JSON.stringify({
          error: isNote
            ? "Empty 'message' — the shortcut sent no text. Share or type a note like \"500 LKR dry food\"."
            : "Empty 'message' — the shortcut sent no SMS text. Run the shortcut from the Share Sheet on an actual SMS, not from the ▶️ button inside the Shortcuts editor.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Notes are intentionally repeatable (same text twice = two drafts),
    // so their hash includes the timestamp. Bank SMS without a date of their
    // own (e.g. FriMi "POS Transaction - NETFLIX.COM ... LKR 3,500.08") repeat
    // word-for-word every month, so those include the minute they arrived:
    // a real repeat next month is kept, a double-fired Shortcut is not.
    const smsHasOwnDate = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/.test(message);
    const contentHash = await sha256(
      isNote
        ? `${keyRow.user_id}|note|${message}|${receivedAt}`
        : smsHasOwnDate
          ? `${keyRow.user_id}|${sender}|${message}`
          : `${keyRow.user_id}|${sender}|${message}|${receivedAt.slice(0, 16)}`,
    );

    // Duplicate check
    const { data: existing } = await admin
      .from("sms_imports")
      .select("id")
      .eq("user_id", keyRow.user_id)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, duplicate: true, sms_import_id: existing.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed = isNote ? parseNote(message) : parseSms(message, receivedAt);
    if (!parsed.amount || !parsed.type) {
      const ai = await aiParseSms(message, sender);
      if (ai) {
        parsed = {
          amount: parsed.amount ?? ai.amount,
          type: parsed.type ?? ai.type,
          accountRef: parsed.accountRef ?? ai.accountRef,
          balance: parsed.balance ?? ai.balance,
          date: parsed.date ?? ai.date,
        };
      }
    }


    // Save as draft — never auto-create a transaction. User confirms in-app.
    const status: "draft" | "unparsed" =
      parsed.amount && parsed.type ? "draft" : "unparsed";

    const { data: smsRow, error: smsErr } = await admin
      .from("sms_imports")
      .insert({
        user_id: keyRow.user_id,
        sender,
        message,
        received_at: receivedAt,
        content_hash: contentHash,
        parsed_amount: parsed.amount,
        parsed_type: parsed.type,
        parsed_account_ref: parsed.accountRef,
        parsed_balance: parsed.balance,
        parsed_date: parsed.date,
        // The wallet picked for this API key in Settings (e.g. FriMi) —
        // the confirm dialog pre-selects it.
        suggested_account_id: keyRow.default_account_id ?? null,
        status,
      })
      .select("id")
      .single();

    if (smsErr || !smsRow) throw smsErr ?? new Error("Failed to insert sms_import");

    await admin
      .from("sms_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    return new Response(
      JSON.stringify({
        ok: true,
        duplicate: false,
        sms_import_id: smsRow.id,
        transaction_id: null,
        status,
        parsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sms-import error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
