// WealthFlow Telegram bot — Supabase Edge Function (webhook).
//
// Button-driven entry. The chat always shows three buttons:
//   Expense · Income · Menu
// Menu holds everything else: Transfer, Balances, Recent, Today, This month,
// Budgets, Drafts and Undo last.
// Tap one, then keep tapping: wallet -> (destination wallet | category) ->
// type the amount -> optional note -> Save.
// The category screen lists every category and subcategory at once, and
// "New category" adds one (main or under an existing one) without leaving the chat.
//
// On Save the bot creates the transaction and updates the wallet balance(s)
// in the same order the app does (insert row, then update_account_balance).
// Only the chat ids in TELEGRAM_ALLOWED_CHAT_ID can use it.

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

// ---------- types ----------

type TxType = "expense" | "income" | "transfer";
type Account = { id: string; name: string; currency: string; type: string };
type Category = { id: string; name: string; parent_id: string | null; kind: string };

type State = {
  step:
    | "wallet" | "to" | "category" | "newcat_where" | "newcat_name"
    | "amount" | "received" | "note" | "confirm";
  type: TxType;
  accountId?: string;
  toAccountId?: string; // transfer only
  category?: string;
  newParentId?: string; // while adding a category: "" = main, else the parent's id
  amount?: number;
  received?: number; // transfer between different currencies
  description?: string;
};

type Button = { text: string; callback_data: string };

// ---------- small helpers ----------

const BTN_EXPENSE = "💸 Expense";
const BTN_INCOME = "💰 Income";
const BTN_TRANSFER = "🔁 Transfer";
const BTN_MENU = "☰ Menu";
const MENU = {
  keyboard: [[{ text: BTN_EXPENSE }, { text: BTN_INCOME }, { text: BTN_MENU }]],
  resize_keyboard: true,
  is_persistent: true,
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const round2 = (n: number) => Math.round(n * 100) / 100;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function tg(method: string, body: Record<string, unknown>) {
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) console.error("telegram", method, resp.status, await resp.text());
}

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

async function show(chatId: number, text: string, rows: Button[][], messageId?: number) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: rows },
  };
  if (messageId) await tg("editMessageText", { ...payload, message_id: messageId });
  else await tg("sendMessage", payload);
}

async function sendMenu(chatId: number, text: string) {
  await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: MENU });
}

/** "1,500.50" / "Rs 1500" / "1500 LKR" -> 1500.5 ; null when there is no positive number. */
function parseAmount(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[0]);
  return isFinite(n) && n > 0 ? n : null;
}

const typeLabel = (t: TxType) =>
  t === "income" ? BTN_INCOME : t === "transfer" ? BTN_TRANSFER : BTN_EXPENSE;
const money = (n: number, c?: string) =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${c ? " " + c : ""}`;

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

/** Today's date (YYYY-MM-DD) in the timezone saved in the user's reminder settings. */
async function todayForUser(): Promise<string> {
  let tz = "UTC";
  try {
    const { data } = await admin
      .from("draft_reminder_settings")
      .select("timezone")
      .eq("user_id", USER_ID)
      .maybeSingle();
    if (data?.timezone) tz = data.timezone as string;
  } catch (_) { /* fall back to UTC */ }
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

async function updateBalance(accountId: string, amount: number) {
  const { error } = await admin.rpc("update_account_balance", {
    _account_id: accountId,
    _amount: amount,
  });
  if (error) throw error;
}

// ---------- the conversation ----------

const FALLBACK_EXPENSE = ["Food", "Transport", "Shopping", "Utilities", "Health", "Entertainment"];
const FALLBACK_INCOME = ["Salary", "Freelance", "Gifts Received", "Refunds"];

/** Decide which question comes next. Steps with a single possible answer are filled in. */
function settle(st: State, accounts: Account[]) {
  if (!st.accountId) {
    if (accounts.length === 1 && st.type !== "transfer") st.accountId = accounts[0].id;
    else { st.step = "wallet"; return; }
  }

  if (st.type === "transfer") {
    if (!st.toAccountId) {
      const others = accounts.filter((a) => a.id !== st.accountId);
      if (others.length === 1) st.toAccountId = others[0].id;
      else { st.step = "to"; return; }
    }
  } else if (!st.category) {
    // Stay on the "add a category" screens while they are in progress.
    if (st.step !== "newcat_where" && st.step !== "newcat_name") st.step = "category";
    return;
  }

  if (st.amount == null) { st.step = "amount"; return; }

  if (st.type === "transfer" && st.received == null) {
    const from = accounts.find((a) => a.id === st.accountId);
    const to = accounts.find((a) => a.id === st.toAccountId);
    if (from && to && from.currency !== to.currency) { st.step = "received"; return; }
  }

  if (st.description == null) { st.step = "note"; return; }
  st.step = "confirm";
}

function view(st: State, accounts: Account[], cats: Category[]): { text: string; rows: Button[][] } {
  const cancel: Button = { text: "❌ Cancel", callback_data: "x" };
  const from = accounts.find((a) => a.id === st.accountId);
  const to = accounts.find((a) => a.id === st.toAccountId);

  // What has been chosen so far, shown above every question.
  const lines = [`<b>${typeLabel(st.type)}</b>`];
  if (from) lines.push(`${st.type === "transfer" ? "From" : "Wallet"}: ${esc(from.name)} (${from.currency})`);
  if (to) lines.push(`To: ${esc(to.name)} (${to.currency})`);
  if (st.category) lines.push(`Category: ${esc(st.category)}`);
  if (st.amount != null) lines.push(`Amount: <b>${money(st.amount, from?.currency)}</b>`);
  if (st.received != null) lines.push(`Received: <b>${money(st.received, to?.currency)}</b>`);
  if (st.description) lines.push(`Note: ${esc(st.description)}`);
  const head = lines.join("\n");

  const walletButtons = (list: Account[], prefix: string) =>
    chunk(
      list.map((a) => ({
        text: `${a.name} (${a.currency})`,
        callback_data: `${prefix}:${a.id.slice(0, 8)}`,
      })),
      2,
    );

  if (st.step === "wallet") {
    const q = st.type === "transfer"
      ? "කොයි wallet එකෙන්ද යවන්නේ?"
      : st.type === "income" ? "කොයි wallet එකටද ලැබුණේ?" : "කොයි wallet එකෙන්ද ගෙව්වේ?";
    return { text: `${head}\n\n${q}`, rows: [...walletButtons(accounts, "a"), [cancel]] };
  }

  if (st.step === "to") {
    const others = accounts.filter((a) => a.id !== st.accountId);
    return {
      text: `${head}\n\nකොයි wallet එකටද යවන්නේ?`,
      rows: [...walletButtons(others, "d"), [cancel]],
    };
  }

  if (st.step === "category") {
    const kind = st.type;
    const parents = cats.filter((c) => !c.parent_id && (c.kind === kind || c.kind === "both"));
    const other = kind === "income" ? "Other Income" : "Other";
    const rows: Button[][] = [];
    // Every category on one screen: the main one on its own row, its
    // subcategories underneath in pairs.
    for (const p of parents) {
      rows.push([{ text: `📁 ${p.name}`, callback_data: `k:${p.id.slice(0, 8)}` }]);
      const kids = cats.filter((c) => c.parent_id === p.id);
      rows.push(...chunk(kids.map((c) => ({ text: c.name, callback_data: `s:${c.id.slice(0, 8)}` })), 2));
    }
    if (!parents.length) {
      rows.push(...chunk(
        (kind === "income" ? FALLBACK_INCOME : FALLBACK_EXPENSE).map((n) => ({ text: n, callback_data: `f:${n}` })),
        2,
      ));
    }
    if (!parents.some((c) => c.name === other)) rows.push([{ text: other, callback_data: `f:${other}` }]);
    rows.push([{ text: "➕ New category", callback_data: "nc" }]);
    return { text: `${head}\n\nCategory එක තෝරන්න:`, rows: [...rows, [cancel]] };
  }

  if (st.step === "newcat_where") {
    const kind = st.type;
    const parents = cats.filter((c) => !c.parent_id && (c.kind === kind || c.kind === "both"));
    return {
      text: `${head}\n\n➕ අලුත් category එක කොතනටද එකතු කරන්නේ?`,
      rows: [
        [{ text: "🆕 Main category එකක් විදියට", callback_data: "np:" }],
        ...chunk(parents.map((p) => ({ text: `📁 ${p.name} යටතට`, callback_data: `np:${p.id.slice(0, 8)}` })), 2),
        [{ text: "↩️ Back", callback_data: "bk" }, cancel],
      ],
    };
  }

  if (st.step === "newcat_name") {
    const parent = cats.find((c) => c.id === st.newParentId);
    const where = parent ? `<b>${esc(parent.name)}</b> යටතට` : "main category එකක් විදියට";
    return {
      text: `${head}\n\n✏️ අලුත් category එකේ නම type කරලා එවන්න (${where}).`,
      rows: [[{ text: "↩️ Back", callback_data: "bk" }, cancel]],
    };
  }

  if (st.step === "amount") {
    return {
      text: `${head}\n\n✏️ මුදල type කරලා එවන්න (${from?.currency ?? ""}). උදා: <code>1500</code>`,
      rows: [[cancel]],
    };
  }

  if (st.step === "received") {
    return {
      text:
        `${head}\n\n✏️ Wallet දෙකේ කරන්සි වෙනස්. <b>${esc(to?.name ?? "")}</b> එකට ලැබුණු මුදල ` +
        `(${to?.currency ?? ""}) type කරලා එවන්න.`,
      rows: [[cancel]],
    };
  }

  if (st.step === "note") {
    return {
      text: `${head}\n\n📝 Note එකක් type කරලා එවන්න, නැත්නම් Skip එබුවා.`,
      rows: [[{ text: "⏭ Skip", callback_data: "n" }], [cancel]],
    };
  }

  return {
    text: `${head}\n\nSave කරන්නද?`,
    rows: [[{ text: "✅ Save", callback_data: "ok" }], [cancel]],
  };
}

/**
 * Add a category (or reuse one with the same name in the same place) and
 * return the value transactions store: "Parent" or "Parent > Child".
 */
async function addCategory(st: State, rawName: string, cats: Category[]): Promise<string> {
  const name = rawName.replace(/\s+/g, " ").trim().slice(0, 40);
  const parent = st.newParentId ? cats.find((c) => c.id === st.newParentId) : undefined;
  if (st.newParentId && !parent) throw new Error("parent category not found");
  const parentId = parent?.id ?? null;

  const existing = cats.find(
    (c) => (c.parent_id ?? null) === parentId && c.name.toLowerCase() === name.toLowerCase(),
  );
  const finalName = existing?.name ?? name;
  if (!existing) {
    const { error } = await admin.from("categories").insert({
      user_id: USER_ID,
      name,
      parent_id: parentId,
      icon: "Tag",
      color: "primary",
      kind: parent ? parent.kind : st.type,
    });
    if (error) throw error;
  }
  return parent ? `${parent.name} > ${finalName}` : finalName;
}

/**
 * Create the transaction and apply its balance effect — the same sequence the
 * app uses: insert the row first, then update_account_balance. If a balance
 * update fails, what was already applied is undone so nothing is left half-saved.
 */
async function postTransaction(st: State, accounts: Account[]): Promise<void> {
  const from = accounts.find((a) => a.id === st.accountId);
  if (!from || st.amount == null) throw new Error("incomplete entry");
  const amount = round2(st.amount);

  const row: Record<string, unknown> = {
    user_id: USER_ID,
    account_id: from.id,
    type: st.type,
    amount,
    currency: from.currency,
    category: st.type === "transfer" ? "Transfer" : st.category ?? "Other",
    description: st.description ?? "",
    date: await todayForUser(),
  };

  let credit = 0; // what the destination wallet receives (transfer only)
  let to: Account | undefined;
  if (st.type === "transfer") {
    to = accounts.find((a) => a.id === st.toAccountId);
    if (!to || to.id === from.id) throw new Error("invalid destination wallet");
    row.to_account_id = to.id;
    if (from.currency !== to.currency) {
      if (st.received == null) throw new Error("missing received amount");
      row.exchange_rate = st.received / amount;
      credit = amount * (st.received / amount);
    } else {
      credit = amount;
    }
  }

  const { data, error } = await admin.from("transactions").insert(row).select("id").single();
  if (error || !data) throw error ?? new Error("insert failed");
  const txId = data.id as string;

  const sign = st.type === "income" ? 1 : -1;
  try {
    await updateBalance(from.id, amount * sign);
  } catch (e) {
    await admin.from("transactions").delete().eq("id", txId);
    throw e;
  }

  if (st.type === "transfer" && to) {
    try {
      await updateBalance(to.id, credit);
    } catch (e) {
      // Undo the debit and the row so the two wallets stay consistent.
      try { await updateBalance(from.id, -amount * sign); } catch (e2) { console.error("undo failed", e2); }
      await admin.from("transactions").delete().eq("id", txId);
      throw e;
    }
  }
}

// ---------- menu: reports and undo ----------

const MENU_ROWS: Button[][] = [
  [{ text: BTN_TRANSFER, callback_data: "m:tr" }],
  [{ text: "💼 Balances", callback_data: "m:bal" }, { text: "🧾 Recent", callback_data: "m:rec" }],
  [{ text: "📊 Today", callback_data: "m:day" }, { text: "📅 This month", callback_data: "m:mon" }],
  [{ text: "🎯 Budgets", callback_data: "m:bud" }, { text: "📥 Drafts", callback_data: "m:dr" }],
  [{ text: "↩️ Undo last", callback_data: "m:undo" }],
];
const MENU_TEXT = "<b>☰ Menu</b>\n\nතෝරන්න:";
const BACK: Button[][] = [[{ text: BTN_MENU, callback_data: "m" }]];

// deno-lint-ignore no-explicit-any
type Tx = Record<string, any>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""}`;

function txLine(tx: Tx, names: Map<string, string>): string {
  const amt = money(Number(tx.amount), tx.currency);
  const note = tx.description ? ` — ${esc(String(tx.description).slice(0, 40))}` : "";
  if (tx.type === "transfer") {
    const a = esc(names.get(tx.account_id) ?? "?");
    const b = esc(names.get(tx.to_account_id) ?? "?");
    return `${shortDate(tx.date)} · 🔁 ${amt} · ${a} → ${b}${note}`;
  }
  const sign = tx.type === "income" ? "+" : "−";
  return `${shortDate(tx.date)} · ${sign}${amt} · ${esc(tx.category ?? "")}${note}`;
}

async function accountNames(): Promise<Map<string, string>> {
  return new Map((await loadAccounts()).map((a) => [a.id, a.name]));
}

async function reportBalances(): Promise<string> {
  const { data, error } = await admin
    .from("accounts")
    .select("name, currency, balance")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { name: string; currency: string; balance: number }[];
  if (!rows.length) return "💼 <b>Balances</b>\n\nWallet එකක්වත් නැහැ.";
  const totals = new Map<string, number>();
  const lines = rows.map((a) => {
    totals.set(a.currency, (totals.get(a.currency) ?? 0) + Number(a.balance));
    return `${esc(a.name)} — <b>${money(Number(a.balance), a.currency)}</b>`;
  });
  const totalLines = [...totals].map(([c, n]) => `Total ${c}: <b>${money(round2(n), c)}</b>`);
  return `💼 <b>Balances</b>\n\n${lines.join("\n")}\n\n${totalLines.join("\n")}`;
}

/** Income, expenses and net per currency for a date range, with the top expense categories. */
async function reportSummary(title: string, from: string, to: string): Promise<string> {
  const { data, error } = await admin
    .from("transactions")
    .select("type, amount, currency, category")
    .eq("user_id", USER_ID)
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;
  const rows = ((data ?? []) as Tx[]).filter((t) => t.type === "income" || t.type === "expense");
  if (!rows.length) return `${title}\n\nIncome හෝ expense එකක්වත් නැහැ.`;

  const blocks: string[] = [];
  for (const cur of [...new Set(rows.map((t) => t.currency as string))]) {
    const mine = rows.filter((t) => t.currency === cur);
    const sum = (type: string) =>
      round2(mine.filter((t) => t.type === type).reduce((n, t) => n + Number(t.amount), 0));
    const income = sum("income");
    const expense = sum("expense");
    const byCat = new Map<string, number>();
    for (const t of mine) {
      if (t.type === "expense") byCat.set(t.category, (byCat.get(t.category) ?? 0) + Number(t.amount));
    }
    const top = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([c, n]) => `  • ${esc(c)} — ${money(round2(n))}`);
    blocks.push(
      `<b>${cur}</b>\n💰 Income: ${money(income)}\n💸 Expense: ${money(expense)}\n` +
      `Net: <b>${money(round2(income - expense))}</b>` +
      (top.length ? `\nවැඩිම වියදම්:\n${top.join("\n")}` : ""),
    );
  }
  return `${title}\n\n${blocks.join("\n\n")}`;
}

async function reportRecent(): Promise<string> {
  const { data, error } = await admin
    .from("transactions")
    .select("type, amount, currency, category, description, date, account_id, to_account_id, created_at")
    .eq("user_id", USER_ID)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  const rows = (data ?? []) as Tx[];
  if (!rows.length) return "🧾 <b>Recent</b>\n\nගනුදෙනු නැහැ.";
  const names = await accountNames();
  return `🧾 <b>Recent</b> (අන්තිම ${rows.length})\n\n${rows.map((t) => txLine(t, names)).join("\n")}`;
}

/** This month's spend against each budget — same rule as the app: exact category, same currency. */
async function reportBudgets(today: string): Promise<string> {
  const { data: budgets, error } = await admin
    .from("budgets")
    .select("category, monthly_limit, currency")
    .eq("user_id", USER_ID)
    .order("category", { ascending: true });
  if (error) throw error;
  const list = (budgets ?? []) as { category: string; monthly_limit: number; currency: string }[];
  if (!list.length) return "🎯 <b>Budgets</b>\n\nBudget එකක්වත් නැහැ. App එකේ Budgets වලින් හදන්න.";

  const { data: txs, error: e2 } = await admin
    .from("transactions")
    .select("category, amount, currency, type")
    .eq("user_id", USER_ID)
    .eq("type", "expense")
    .gte("date", `${today.slice(0, 7)}-01`)
    .lte("date", today);
  if (e2) throw e2;
  const spent = new Map<string, number>();
  for (const t of (txs ?? []) as Tx[]) {
    const k = `${t.category}::${t.currency}`;
    spent.set(k, (spent.get(k) ?? 0) + Number(t.amount));
  }
  const lines = list.map((b) => {
    const used = round2(spent.get(`${b.category}::${b.currency}`) ?? 0);
    const limit = Number(b.monthly_limit);
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const mark = pct >= 100 ? "🔴" : pct >= 80 ? "⚠️" : "✅";
    return `${mark} ${esc(b.category)} — ${money(used)} / ${money(limit, b.currency)} (${pct}%)`;
  });
  return `🎯 <b>Budgets</b> (මේ මාසය)\n\n${lines.join("\n")}`;
}

async function reportDrafts(): Promise<string> {
  const { data, error } = await admin
    .from("sms_imports")
    .select("sender, parsed_amount, parsed_type, message, received_at, status")
    .eq("user_id", USER_ID)
    .in("status", ["draft", "unparsed"])
    .order("received_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = (data ?? []) as Tx[];
  if (!rows.length) return "📥 <b>Drafts</b>\n\nConfirm කරන්න තියෙන draft නැහැ ✅";
  const lines = rows.slice(0, 8).map((d) => {
    const amt = d.parsed_amount != null ? money(Number(d.parsed_amount)) : "?";
    return `• ${amt} · ${esc(String(d.sender))} — ${esc(String(d.message).slice(0, 45))}`;
  });
  const more = rows.length > 8 ? `\n… තව ${rows.length - 8}${rows.length === 50 ? "+" : ""}` : "";
  return `📥 <b>Drafts</b> (${rows.length}${rows.length === 50 ? "+" : ""})\n\n${lines.join("\n")}${more}\n\n` +
    "Confirm කරන්න WealthFlow → Draft Inbox එකට යන්න.";
}

async function lastTransaction(): Promise<Tx | null> {
  const { data, error } = await admin
    .from("transactions")
    .select("*")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? []) as Tx[])[0] ?? null;
}

/**
 * Delete the most recent transaction and put the wallet balance(s) back —
 * the reverse of what saving did. The row is removed first, and only the call
 * that actually removed it reverses the balances, so a double tap cannot
 * reverse twice. If a balance update fails the row is restored.
 */
async function undoTransaction(tx: Tx): Promise<boolean> {
  const { data, error } = await admin.from("transactions").delete().eq("id", tx.id).select("id");
  if (error) throw error;
  if (!data || (data as Tx[]).length === 0) return false; // already removed

  const amount = Number(tx.amount);
  const sign = tx.type === "income" ? -1 : 1;
  const restore = async () => {
    const { error: e } = await admin.from("transactions").insert(tx);
    if (e) console.error("could not restore transaction", tx.id, e);
  };
  try {
    await updateBalance(tx.account_id, amount * sign);
  } catch (e) {
    await restore();
    throw e;
  }
  if (tx.type === "transfer" && tx.to_account_id) {
    const credit = amount * (Number(tx.exchange_rate) || 1) - (Number(tx.transfer_charge) || 0);
    try {
      await updateBalance(tx.to_account_id, -credit);
    } catch (e) {
      try { await updateBalance(tx.account_id, -amount * sign); } catch (e2) { console.error("undo failed", e2); }
      await restore();
      throw e;
    }
  }
  return true;
}

async function onMenu(chatId: number, messageId: number, data: string) {
  if (data === "m") return show(chatId, MENU_TEXT, MENU_ROWS, messageId);
  if (data === "m:tr") return startEntry(chatId, "transfer", messageId);

  try {
    if (data === "m:bal") return await show(chatId, await reportBalances(), BACK, messageId);
    if (data === "m:rec") return await show(chatId, await reportRecent(), BACK, messageId);
    if (data === "m:dr") return await show(chatId, await reportDrafts(), BACK, messageId);

    const today = await todayForUser();
    if (data === "m:day") {
      return await show(chatId, await reportSummary(`📊 <b>Today</b> (${shortDate(today)})`, today, today), BACK, messageId);
    }
    if (data === "m:mon") {
      const title = `📅 <b>This month</b> (1 – ${shortDate(today)})`;
      return await show(chatId, await reportSummary(title, `${today.slice(0, 7)}-01`, today), BACK, messageId);
    }
    if (data === "m:bud") return await show(chatId, await reportBudgets(today), BACK, messageId);

    if (data === "m:undo") {
      const tx = await lastTransaction();
      if (!tx) return await show(chatId, "↩️ <b>Undo last</b>\n\nගනුදෙනු නැහැ.", BACK, messageId);
      const line = txLine(tx, await accountNames());
      if (tx.debt_id || tx.investment_id) {
        return await show(
          chatId,
          `↩️ <b>Undo last</b>\n\n${line}\n\nමේක debt/investment එකකට සම්බන්ධයි, ඒ නිසා මෙතනින් undo කරන්න බැහැ. App එකෙන් කරන්න.`,
          BACK,
          messageId,
        );
      }
      return await show(
        chatId,
        `↩️ <b>Undo last</b>\n\n${line}\n\nමේ transaction එක delete කරලා balance එක ආපහු හදන්නද?`,
        [[{ text: "🗑 Delete කරන්න", callback_data: `u:${String(tx.id).slice(0, 8)}` }], ...BACK],
        messageId,
      );
    }

    if (data.startsWith("u:")) {
      const tx = await lastTransaction();
      // Only ever undo the one that was shown; if something newer exists, stop.
      if (!tx || !String(tx.id).startsWith(data.slice(2)) || tx.debt_id || tx.investment_id) {
        return await show(chatId, "↩️ ඒ transaction එක දැන් අන්තිම එක නෙවෙයි, නැත්නම් දැනටමත් delete වෙලා. කිසිම දෙයක් වෙනස් කළේ නැහැ.", BACK, messageId);
      }
      const line = txLine(tx, await accountNames());
      const done = await undoTransaction(tx);
      return await show(
        chatId,
        done ? `✅ <b>Delete උනා</b>, balance එක ආපහු හැදුවා.\n\n${line}` : "↩️ ඒක දැනටමත් delete වෙලා.",
        BACK,
        messageId,
      );
    }
  } catch (e) {
    console.error("menu", data, e);
    await show(chatId, "⚠️ ඒක කරන්න බැරි උනා. ආයෙ උත්සාහ කරන්න.", BACK, messageId);
  }
}

// ---------- update handling ----------

const WELCOME =
  "👋 <b>WealthFlow bot</b>\n\nයට තියෙන බොත්තම් වලින් පටන් ගන්න: " +
  "Expense, Income.\nTransfer, balances, reports, budgets, undo වගේ ඒවා <b>Menu</b> එකේ.";

async function startEntry(chatId: number, type: TxType, messageId?: number) {
  const accounts = await loadAccounts();
  if (accounts.length === 0) {
    await sendMenu(chatId, "WealthFlow එකේ තවම wallet එකක් නැහැ. මුලින් app එකේ Accounts වල එකක් හදන්න.");
    return;
  }
  if (type === "transfer" && accounts.length < 2) {
    await sendMenu(chatId, "Transfer එකකට wallet දෙකක්වත් ඕන.");
    return;
  }
  const cats = type === "transfer" ? [] : await loadCategories();
  const st: State = { step: "wallet", type };
  settle(st, accounts);
  await saveSession(chatId, st);
  const v = view(st, accounts, cats);
  await show(chatId, v.text, v.rows, messageId);
}

async function onText(chatId: number, text: string) {
  const t = text.trim();
  const cmd = t.split(/\s+/)[0].toLowerCase().replace(/@\w+$/, "");

  if (cmd === "/start" || cmd === "/help") {
    await clearSession(chatId);
    await sendMenu(chatId, WELCOME);
    return;
  }
  if (cmd === "/cancel") {
    await clearSession(chatId);
    await sendMenu(chatId, "අත්හැරියා ✅");
    return;
  }
  if (t === BTN_EXPENSE || cmd === "/expense") return startEntry(chatId, "expense");
  if (t === BTN_INCOME || cmd === "/income") return startEntry(chatId, "income");
  if (t === BTN_TRANSFER || cmd === "/transfer") return startEntry(chatId, "transfer");
  if (t === BTN_MENU || cmd === "/menu") return show(chatId, MENU_TEXT, MENU_ROWS);

  // Otherwise the text is an answer to "type the amount" / "type a note".
  const st = await loadSession(chatId);
  if (!st || !["amount", "received", "note", "newcat_name"].includes(st.step)) {
    await sendMenu(chatId, "යට තියෙන බොත්තමකින් පටන් ගන්න: Expense, Income, Menu.");
    return;
  }

  const cats = st.type === "transfer" ? [] : await loadCategories();

  if (st.step === "note") {
    st.description = t.slice(0, 200);
  } else if (st.step === "newcat_name") {
    const name = t.replace(/\s+/g, " ").trim();
    if (!name || name.startsWith("/") || name.includes(">")) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "ඒ නම පාවිච්චි කරන්න බැහැ. '>' හෝ '/' නැති කෙටි නමක් එවන්න, උදා: Fuel",
      });
      return;
    }
    try {
      st.category = await addCategory(st, name, cats);
      delete st.newParentId;
      st.step = "category";
    } catch (e) {
      console.error("addCategory", e);
      await tg("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Category එක හදන්න බැරි උනා. ආයෙ නම එවන්න, නැත්නම් Back එබුවා.",
      });
      return;
    }
  } else {
    const n = parseAmount(t);
    if (n == null) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "ඒක මුදලක් විදියට කියවන්න බැරි උනා. ඉලක්කම් විතරක් එවන්න, උදා: 1500",
      });
      return;
    }
    if (st.step === "amount") st.amount = n;
    else st.received = n;
  }

  const accounts = await loadAccounts();
  settle(st, accounts);
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
  // Menu screens and undo do not belong to an entry in progress.
  if (data === "m" || data.startsWith("m:") || data.startsWith("u:")) {
    await onMenu(chatId, messageId, data);
    return;
  }

  const st = await loadSession(chatId);
  if (!st) {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "මේ entry එක කල් ඉකුත් වෙලා හෝ දැනටමත් save වෙලා. යට බොත්තමකින් අලුතින් පටන් ගන්න.",
    });
    return;
  }

  const accounts = await loadAccounts();
  const cats = st.type === "transfer" ? [] : await loadCategories();

  if (data === "ok") {
    if (st.step !== "confirm") return;
    // Clear first so a double tap cannot save the same transaction twice.
    await clearSession(chatId);
    const summary = view({ ...st, step: "confirm" }, accounts, cats).text.replace(/\n\nSave කරන්නද\?$/, "");
    try {
      await postTransaction(st, accounts);
    } catch (e) {
      console.error("postTransaction", e);
      await tg("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: "⚠️ Save කරන්න බැරි උනා, කිසිම දෙයක් වෙනස් වෙලා නැහැ. ආයෙ උත්සාහ කරන්න.",
      });
      return;
    }
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      text: `✅ <b>Save උනා</b>\n\n${summary}`,
    });
    return;
  }

  // Each button only counts on the step it belongs to, so an old message's
  // buttons cannot change a later step.
  if (data.startsWith("a:") && st.step === "wallet") {
    const acc = accounts.find((a) => a.id.startsWith(data.slice(2)));
    if (acc) st.accountId = acc.id;
  } else if (data.startsWith("d:") && st.step === "to") {
    const acc = accounts.find((a) => a.id.startsWith(data.slice(2)) && a.id !== st.accountId);
    if (acc) st.toAccountId = acc.id;
  } else if (data.startsWith("k:") && st.step === "category") {
    const parent = cats.find((c) => !c.parent_id && c.id.startsWith(data.slice(2)));
    if (parent) st.category = parent.name;
  } else if (data.startsWith("s:") && st.step === "category") {
    const child = cats.find((c) => c.parent_id && c.id.startsWith(data.slice(2)));
    const parent = child ? cats.find((c) => c.id === child.parent_id) : undefined;
    if (child && parent) st.category = `${parent.name} > ${child.name}`;
  } else if (data.startsWith("f:") && st.step === "category") {
    st.category = data.slice(2);
  } else if (data === "nc" && st.step === "category") {
    st.step = "newcat_where";
  } else if (data.startsWith("np:") && st.step === "newcat_where") {
    const p = data.slice(3);
    const parent = p ? cats.find((c) => !c.parent_id && c.id.startsWith(p)) : undefined;
    if (p && !parent) return;
    st.newParentId = parent?.id ?? "";
    st.step = "newcat_name";
  } else if (data === "bk" && st.step === "newcat_where") {
    st.step = "category";
  } else if (data === "bk" && st.step === "newcat_name") {
    delete st.newParentId;
    st.step = "newcat_where";
  } else if (data === "n" && st.step === "note") {
    st.description = "";
  } else {
    return; // a button from an earlier step — ignore it
  }

  settle(st, accounts);
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
          "</code>\n(මේ අංකය TELEGRAM_ALLOWED_CHAT_ID secret එකට දාන්න.)",
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
