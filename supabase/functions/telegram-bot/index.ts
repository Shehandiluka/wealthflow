// WealthFlow Telegram bot — Supabase Edge Function (webhook).
//
// Works like the Quick Note: every entry is saved as a DRAFT in `sms_imports`
// (sender "Telegram Note"). It never creates a transaction or touches a balance,
// so you still Review & Confirm it in WealthFlow → SMS Imports (Draft Inbox).
//
// Flow: send "1500 dry food" -> pick Income/Expense -> Currency -> Wallet
//       -> Category (+ subcategory) -> Save as draft.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const USER_ID = Deno.env.get("WEALTHFLOW_USER_ID") ?? "";
const ALLOWED_CHATS = (Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SESSION_TTL_MS = 60 * 60 * 1000; // a half-finished entry expires after 1 hour

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- small helpers ----------

type Account = { id: string; name: string; currency: string; type: string };
type Category = { id: string; name: string; parent_id: string | null; kind: string };

type State = {
  step: "type" | "currency" | "wallet" | "category" | "sub" | "confirm";
  amount: number;
  description: string;
  hint: string | null; // currency typed inside the message, if any
  guess: "income" | "expense";
  type?: "income" | "expense";
  currency?: string;
  accountId?: string;
  category?: string;
  parentId?: string; // while choosing a subcategory
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tg(method: string, body: Record<string, unknown>) {
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) console.error("telegram", method, resp.status, await resp.text());
}

type Button = { text: string; callback_data: string };
const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

async function show(
  chatId: number,
  text: string,
  rows: Button[][],
  messageId?: number,
) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
  };
  if (messageId) await tg("editMessageText", { ...payload, message_id: messageId });
  else await tg("sendMessage", payload);
}

// ---------- parsing the typed text ----------

const CUR_MAP: Record<string, string> = {
  LKR: "LKR", RS: "LKR", "RS.": "LKR", USD: "USD", "$": "USD", EUR: "EUR", "€": "EUR",
  GBP: "GBP", "£": "GBP", ILS: "ILS", NIS: "ILS", "₪": "ILS", INR: "INR", "₹": "INR",
  AED: "AED", SGD: "SGD",
};
const CUR_TOKENS = "LKR|Rs\\.?|INR|USD|EUR|GBP|AED|SGD|ILS|NIS|\\$|€|£|₹|₪";
const AMOUNT_RE = new RegExp(
  `(?<![A-Za-z])(${CUR_TOKENS})?\\s*(\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(?:(${CUR_TOKENS})(?![A-Za-z]))?`,
  "i",
);
const INCOME_WORDS =
  /\b(received|refund|salary|income|got paid|earned|credited|bonus|cashback|gift)\b/i;

function parseText(text: string) {
  const m = text.match(AMOUNT_RE);
  if (!m) return null;
  const amount = Number(m[2].replace(/,/g, ""));
  if (!isFinite(amount) || amount <= 0) return null;
  const raw = (m[1] ?? m[3] ?? "").toUpperCase();
  const hint = raw ? CUR_MAP[raw] ?? null : null;
  const description =
    text.replace(m[0], " ").replace(/\s+/g, " ").trim() || "Telegram";
  const guess: "income" | "expense" = INCOME_WORDS.test(text) ? "income" : "expense";
  return { amount, hint, description, guess };
}

// ---------- data access ----------

async function loadAccounts(): Promise<Account[]> {
  const { data, error } = await admin
    .from("accounts")
    .select("id, name, currency, type")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Account[];
}

async function loadCategories(): Promise<Category[]> {
  const { data, error } = await admin
    .from("categories")
    .select("id, name, parent_id, kind, sort_order")
    .eq("user_id", USER_ID)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

async function loadSession(chatId: number): Promise<State | null> {
  const { data } = await admin
    .from("telegram_sessions")
    .select("state, updated_at")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.updated_at).getTime() > SESSION_TTL_MS) return null;
  return data.state as State;
}

async function saveSession(chatId: number, state: State) {
  await admin
    .from("telegram_sessions")
    .upsert({ chat_id: chatId, state, updated_at: new Date().toISOString() });
}

async function clearSession(chatId: number) {
  await admin.from("telegram_sessions").delete().eq("chat_id", chatId);
}

// ---------- the conversation ----------

const FALLBACK_EXPENSE = ["Food", "Transport", "Shopping", "Utilities", "Health", "Entertainment"];
const FALLBACK_INCOME = ["Salary", "Freelance", "Gifts Received", "Refunds"];

const typeLabel = (t?: string) => (t === "income" ? "💰 Income" : "💸 Expense");
const money = (n: number, c?: string) =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${c ? " " + c : ""}`;

/** Fill in every step that has only one sensible answer, stop at the first real choice. */
function settle(st: State, accounts: Account[], cats: Category[]) {
  if (!st.type) { st.step = "type"; return; }

  const currencies = [...new Set(accounts.map((a) => a.currency))];
  if (!st.currency) {
    if (st.hint && currencies.includes(st.hint)) st.currency = st.hint;
    else if (currencies.length === 1) st.currency = currencies[0];
    else { st.step = "currency"; return; }
  }

  if (!st.accountId) {
    const wallets = accounts.filter((a) => a.currency === st.currency);
    if (wallets.length === 1) st.accountId = wallets[0].id;
    else { st.step = "wallet"; return; }
  }

  if (!st.category) {
    st.step = st.parentId ? "sub" : "category";
    void cats;
    return;
  }
  st.step = "confirm";
}

function view(st: State, accounts: Account[], cats: Category[]): { text: string; rows: Button[][] } {
  const head = `💬 <b>${money(st.amount, st.currency ?? st.hint ?? undefined)}</b> — ${esc(st.description)}`;
  const cancel: Button[] = [{ text: "❌ Cancel", callback_data: "x" }];

  if (st.step === "type") {
    const order: ("expense" | "income")[] = st.guess === "income" ? ["income", "expense"] : ["expense", "income"];
    return {
      text: `${head}\n\nමේක මොන වර්ගයේද?`,
      rows: [
        order.map((t) => ({ text: typeLabel(t), callback_data: t === "income" ? "t:i" : "t:e" })),
        cancel,
      ],
    };
  }

  if (st.step === "currency") {
    const currencies = [...new Set(accounts.map((a) => a.currency))];
    return {
      text: `${head}\n${typeLabel(st.type)}\n\nකරන්සිය තෝරන්න:`,
      rows: [...chunk(currencies.map((c) => ({ text: c, callback_data: `c:${c}` })), 3), cancel],
    };
  }

  if (st.step === "wallet") {
    const wallets = accounts.filter((a) => a.currency === st.currency);
    return {
      text: `${head}\n${typeLabel(st.type)} · ${st.currency}\n\nගිණුම (wallet) තෝරන්න:`,
      rows: [
        ...chunk(wallets.map((a) => ({ text: a.name, callback_data: `a:${a.id.slice(0, 8)}` })), 2),
        cancel,
      ],
    };
  }

  if (st.step === "category") {
    const kind = st.type!;
    const parents = cats.filter((c) => !c.parent_id && (c.kind === kind || c.kind === "both"));
    const other = kind === "income" ? "Other Income" : "Other";
    const buttons: Button[] = parents.length
      ? parents.map((c) => ({ text: c.name, callback_data: `k:${c.id.slice(0, 8)}` }))
      : (kind === "income" ? FALLBACK_INCOME : FALLBACK_EXPENSE).map((n) => ({
          text: n, callback_data: `f:${n}`,
        }));
    if (!parents.some((c) => c.name === other)) buttons.push({ text: other, callback_data: `f:${other}` });
    return {
      text: `${head}\n${typeLabel(st.type)} · ${st.currency}\n\nප්‍රවර්ගය (category) තෝරන්න:`,
      rows: [...chunk(buttons, 2), cancel],
    };
  }

  if (st.step === "sub") {
    const parent = cats.find((c) => c.id === st.parentId);
    const kids = cats.filter((c) => c.parent_id === st.parentId);
    return {
      text: `${head}\n${typeLabel(st.type)} · ${st.currency}\n\n<b>${esc(parent?.name ?? "")}</b> — උප ප්‍රවර්ගය තෝරන්න:`,
      rows: [
        [{ text: `${parent?.name ?? ""} (General)`, callback_data: "g" }],
        ...chunk(kids.map((c) => ({ text: c.name, callback_data: `s:${c.id.slice(0, 8)}` })), 2),
        [{ text: "↩️ Back", callback_data: "bk" }, cancel[0]],
      ],
    };
  }

  const wallet = accounts.find((a) => a.id === st.accountId);
  return {
    text:
      `📝 <b>Draft සාරාංශය</b>\n\n` +
      `වර්ගය: ${typeLabel(st.type)}\n` +
      `ප්‍රමාණය: <b>${money(st.amount, st.currency)}</b>\n` +
      `ගිණුම: ${esc(wallet?.name ?? "?")}\n` +
      `ප්‍රවර්ගය: ${esc(st.category ?? "?")}\n` +
      `විස්තරය: ${esc(st.description)}\n\n` +
      `Draft Inbox එකට සේව් කරන්නද?`,
    rows: [
      [{ text: "✅ Save as draft", callback_data: "ok" }],
      [{ text: "🔁 Start over", callback_data: "r" }, cancel[0]],
    ],
  };
}

async function saveDraft(st: State): Promise<string> {
  const message = `${st.amount} ${st.currency} ${st.description}`.trim().slice(0, 4000);
  const receivedAt = new Date().toISOString();
  // Same convention as the in-app Quick Note: the timestamp is part of the hash,
  // so typing the same note twice gives two drafts.
  const contentHash = await sha256(`${USER_ID}|note|telegram|${message}|${receivedAt}`);

  const { data, error } = await admin
    .from("sms_imports")
    .insert({
      user_id: USER_ID,
      sender: "Telegram Note",
      message,
      received_at: receivedAt,
      content_hash: contentHash,
      parsed_amount: st.amount,
      parsed_type: st.type,
      parsed_account_ref: null,
      parsed_balance: null,
      parsed_date: null,
      status: "draft",
      suggested_account_id: st.accountId ?? null,
      suggested_category: st.category ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  return data.id as string;
}

const HELP =
  "👋 <b>WealthFlow Quick Note bot</b>\n\n" +
  "ගනුදෙනුවක් එවන්න — උදා:\n" +
  "<code>1500 dry food</code>\n" +
  "<code>2000 LKR salary</code>\n" +
  "<code>50 ILS taxi</code>\n\n" +
  "ඊට පස්සේ බොත්තම් වලින් Income/Expense, කරන්සිය, ගිණුම, ප්‍රවර්ගය තෝරන්න. " +
  "සේව් වෙන්නේ <b>Draft</b> එකක් විදිහට — WealthFlow → SMS Imports එකෙන් Confirm කරන්න.\n\n" +
  "/cancel — වත්මන් එක අත්හරින්න · /id — ඔබේ chat id";

// ---------- update handling ----------

async function onText(chatId: number, text: string) {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase().replace(/@\w+$/, "");

  if (cmd === "/start" || cmd === "/help") {
    await tg("sendMessage", { chat_id: chatId, text: HELP, parse_mode: "HTML" });
    return;
  }
  if (cmd === "/cancel") {
    await clearSession(chatId);
    await tg("sendMessage", { chat_id: chatId, text: "අත්හැරියා ✅" });
    return;
  }

  const parsed = parseText(text);
  if (!parsed) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "ප්‍රමාණය (අංකයක්) හොයාගන්න බැරි වුණා. උදා: <code>1500 dry food</code>",
      parse_mode: "HTML",
    });
    return;
  }

  const accounts = await loadAccounts();
  if (accounts.length === 0) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "WealthFlow එකේ තවම ගිණුමක් (wallet) නැහැ. මුලින් app එකේ Accounts වල එකක් හදන්න.",
    });
    return;
  }
  const cats = await loadCategories();

  const st: State = {
    step: "type",
    amount: parsed.amount,
    description: parsed.description,
    hint: parsed.hint,
    guess: parsed.guess,
  };
  settle(st, accounts, cats);
  await saveSession(chatId, st);
  const v = view(st, accounts, cats);
  await show(chatId, v.text, v.rows);
}

async function onCallback(chatId: number, messageId: number, data: string) {
  if (data === "x") {
    await clearSession(chatId);
    await tg("editMessageText", { chat_id: chatId, message_id: messageId, text: "❌ අත්හැරියා." });
    return;
  }

  const st = await loadSession(chatId);
  if (!st) {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "මේ entry එක කල් ඉකුත් වෙලා හෝ දැනටමත් සේව් වෙලා. අලුතින් එවන්න.",
    });
    return;
  }

  const accounts = await loadAccounts();
  const cats = await loadCategories();

  if (data === "ok") {
    if (st.step !== "confirm") return;
    // Clear first so a double tap cannot save the same draft twice.
    await clearSession(chatId);
    try {
      await saveDraft(st);
    } catch (e) {
      console.error("saveDraft", e);
      await tg("editMessageText", {
        chat_id: chatId, message_id: messageId,
        text: "⚠️ Draft එක සේව් කරන්න බැරි වුණා. ටික වේලාවකින් අලුතින් එවන්න.",
      });
      return;
    }
    const wallet = accounts.find((a) => a.id === st.accountId);
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      text:
        `✅ <b>Draft එකට දැම්මා</b>\n${typeLabel(st.type)} · <b>${money(st.amount, st.currency)}</b>\n` +
        `${esc(wallet?.name ?? "")} · ${esc(st.category ?? "")}\n${esc(st.description)}\n\n` +
        `WealthFlow → SMS Imports එකෙන් Review & Confirm කරන්න.`,
    });
    return;
  }

  if (data === "r") {
    delete st.type; delete st.currency; delete st.accountId; delete st.category; delete st.parentId;
  } else if (data.startsWith("t:")) {
    st.type = data === "t:i" ? "income" : "expense";
    delete st.category; delete st.parentId;
  } else if (data.startsWith("c:")) {
    st.currency = data.slice(2);
    delete st.accountId;
  } else if (data.startsWith("a:")) {
    const p = data.slice(2);
    const acc = accounts.find((a) => a.id.startsWith(p) && a.currency === st.currency);
    if (acc) st.accountId = acc.id;
  } else if (data.startsWith("k:")) {
    const p = data.slice(2);
    const parent = cats.find((c) => !c.parent_id && c.id.startsWith(p));
    if (parent) {
      if (cats.some((c) => c.parent_id === parent.id)) st.parentId = parent.id;
      else st.category = parent.name;
    }
  } else if (data.startsWith("s:")) {
    const p = data.slice(2);
    const child = cats.find((c) => c.parent_id === st.parentId && c.id.startsWith(p));
    const parent = cats.find((c) => c.id === st.parentId);
    if (child && parent) { st.category = `${parent.name} > ${child.name}`; delete st.parentId; }
  } else if (data === "g") {
    const parent = cats.find((c) => c.id === st.parentId);
    if (parent) { st.category = parent.name; delete st.parentId; }
  } else if (data === "bk") {
    delete st.parentId;
  } else if (data.startsWith("f:")) {
    st.category = data.slice(2);
  }

  settle(st, accounts, cats);
  await saveSession(chatId, st);
  const v = view(st, accounts, cats);
  await show(chatId, v.text, v.rows, messageId);
}

// deno-lint-ignore no-explicit-any
async function handle(update: any) {
  const msg = update.message;
  const cb = update.callback_query;
  const chat = msg?.chat ?? cb?.message?.chat;
  if (!chat || chat.type !== "private") return;
  const chatId: number = chat.id;

  if (!ALLOWED_CHATS.includes(String(chatId))) {
    if (cb) await tg("answerCallbackQuery", { callback_query_id: cb.id });
    if (msg) {
      await tg("sendMessage", {
        chat_id: chatId,
        parse_mode: "HTML",
        text:
          "🚫 මේ bot එක පෞද්ගලිකයි.\nඔබේ chat id: <code>" + chatId +
          "</code>\n(හිමිකරු මේක TELEGRAM_ALLOWED_CHAT_ID එකට එකතු කළ යුතුයි.)",
      });
    }
    return;
  }

  if (cb) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    if (cb.message?.message_id && typeof cb.data === "string") {
      await onCallback(chatId, cb.message.message_id, cb.data);
    }
    return;
  }

  if (msg && typeof msg.text === "string") {
    if (msg.text.trim().toLowerCase().startsWith("/id")) {
      await tg("sendMessage", {
        chat_id: chatId, parse_mode: "HTML", text: `chat id: <code>${chatId}</code>`,
      });
      return;
    }
    await onText(chatId, msg.text);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (!BOT_TOKEN || !WEBHOOK_SECRET || !USER_ID) {
    console.error("telegram-bot is missing required secrets");
    return new Response("not configured", { status: 500 });
  }
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(secret, WEBHOOK_SECRET)) return new Response("unauthorized", { status: 401 });

  let update;
  try { update = await req.json(); } catch { return new Response("ok"); }

  try {
    await handle(update);
  } catch (e) {
    console.error("telegram-bot error", e);
  }
  return new Response("ok"); // always 200 so Telegram does not keep retrying
});
