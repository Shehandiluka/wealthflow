// WealthFlow Telegram bot — Supabase Edge Function (webhook).
//
// Button-driven entry. The chat always shows three buttons:
//   Expense · Income · Menu
// Menu holds everything else: Transfer, Pay Later, Lend & Borrow, Balances,
// Recent, Today, This month, Budgets, Drafts and Undo last.
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
    | "amount" | "received" | "note" | "confirm"
    | "pl_name" | "pl_cur" | "pl_wallet"
    | "lb_name" | "lb_wallet" | "lb_cur" | "lb_base";
  // A transaction, a Pay Later action (new tab / purchase / payment),
  // or a Lend & Borrow action (new person / an entry for a person).
  type: TxType | "pl_new" | "pl_buy" | "pl_pay" | "lb_new" | "lb_tx";
  accountId?: string;
  toAccountId?: string; // transfer only
  category?: string;
  newParentId?: string; // while adding a category: "" = main, else the parent's id
  amount?: number;
  received?: number; // transfer between different currencies
  description?: string;
  // Pay Later
  tabId?: string;
  plName?: string; // the tab's person / store
  currency?: string; // the tab's currency
  remaining?: number; // what is still owed on the tab (payment only)
  noWallet?: boolean; // payment recorded without touching a wallet
  // Lend & Borrow
  contactId?: string;
  lbName?: string;
  lbAction?: LbAction;
  lbCurrency?: string | null; // the person's balance currency, null for a fresh person
  lbOwed?: number; // what is outstanding in the direction this repayment settles
  base?: number; // the amount in the person's currency, when the wallet's differs
};

type LbAction = "lent" | "borrowed" | "repaid_to_me" | "repaid_by_me";

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

const BTN_PAYLATER = "🛒 Pay Later";
const BTN_LEND = "🤝 Lend & Borrow";
const LB_LABEL: Record<LbAction, string> = {
  lent: "📤 මම දුන්නා (Lent)",
  borrowed: "📥 මම ගත්තා (Borrowed)",
  repaid_to_me: "✅ එයා ආපහු දුන්නා",
  repaid_by_me: "💵 මම ආපහු දුන්නා",
};
const typeLabel = (t: State["type"]) =>
  t === "income" ? BTN_INCOME
    : t === "transfer" ? BTN_TRANSFER
    : t === "pl_new" ? `${BTN_PAYLATER} · New tab`
    : t === "pl_buy" ? `${BTN_PAYLATER} · Purchase`
    : t === "pl_pay" ? `${BTN_PAYLATER} · Payment`
    : t === "lb_new" ? `${BTN_LEND} · New person`
    : t === "lb_tx" ? BTN_LEND
    : BTN_EXPENSE;
/** Categories offered for this entry: income ones for Income, expense ones otherwise. */
const kindOf = (st: State) => (st.type === "income" ? "income" : "expense");
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
  const keepNewCat = st.step === "newcat_where" || st.step === "newcat_name";

  if (st.type === "pl_new") {
    if (!st.plName) { st.step = "pl_name"; return; }
    if (!st.currency) {
      const currencies = [...new Set(accounts.map((a) => a.currency))];
      if (currencies.length === 1) st.currency = currencies[0];
      else { st.step = "pl_cur"; return; }
    }
    st.step = "confirm";
    return;
  }
  if (st.type === "pl_buy") {
    if (!st.category) { if (!keepNewCat) st.step = "category"; return; }
    if (st.amount == null) { st.step = "amount"; return; }
    if (st.description == null) { st.step = "note"; return; }
    st.step = "confirm";
    return;
  }
  if (st.type === "lb_new") {
    st.step = st.lbName ? "confirm" : "lb_name";
    return;
  }
  if (st.type === "lb_tx") {
    if (!st.accountId && !st.noWallet) { st.step = "lb_wallet"; return; }
    if (st.noWallet && !st.currency) {
      if (st.lbCurrency) st.currency = st.lbCurrency;
      else {
        const currencies = [...new Set(accounts.map((a) => a.currency))];
        if (currencies.length === 1) st.currency = currencies[0];
        else { st.step = "lb_cur"; return; }
      }
    }
    if (st.amount == null) { st.step = "amount"; return; }
    if (st.lbCurrency && st.currency !== st.lbCurrency && st.base == null) { st.step = "lb_base"; return; }
    if (st.description == null) { st.step = "note"; return; }
    st.step = "confirm";
    return;
  }
  if (st.type === "pl_pay") {
    if (st.amount == null) { st.step = "amount"; return; }
    if (!st.accountId && !st.noWallet) { st.step = "pl_wallet"; return; }
    if (st.description == null) { st.step = "note"; return; }
    st.step = "confirm";
    return;
  }

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
    if (!keepNewCat) st.step = "category";
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
  if (st.plName) lines.push(`Tab: ${esc(st.plName)}${st.currency ? ` (${st.currency})` : ""}`);
  if (st.lbName) lines.push(`Person: ${esc(st.lbName)}`);
  if (st.lbAction) lines.push(LB_LABEL[st.lbAction]);
  if (st.lbOwed) lines.push(`ඉතිරි: ${money(st.lbOwed, st.lbCurrency ?? undefined)}`);
  if (st.type === "pl_pay" && st.remaining != null) lines.push(`Remaining: ${money(st.remaining, st.currency)}`);
  if (from) lines.push(`${st.type === "transfer" ? "From" : "Wallet"}: ${esc(from.name)} (${from.currency})`);
  if (to) lines.push(`To: ${esc(to.name)} (${to.currency})`);
  if (st.category) lines.push(`Category: ${esc(st.category)}`);
  if (st.amount != null) lines.push(`Amount: <b>${money(st.amount, from?.currency ?? st.currency)}</b>`);
  if (st.noWallet) lines.push("Wallet: — (record විතරයි)");
  if (st.base != null) lines.push(`${st.lbCurrency} වලින්: <b>${money(st.base, st.lbCurrency ?? undefined)}</b>`);
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
    const kind = kindOf(st);
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
    const kind = kindOf(st);
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

  if (st.step === "pl_name") {
    return { text: `${head}\n\n✏️ කඩේ හෝ කෙනාගේ නම type කරලා එවන්න.`, rows: [[cancel]] };
  }

  if (st.step === "pl_cur") {
    const currencies = [...new Set(accounts.map((a) => a.currency))];
    return {
      text: `${head}\n\nකරන්සිය තෝරන්න:`,
      rows: [...chunk(currencies.map((c) => ({ text: c, callback_data: `pc:${c}` })), 3), [cancel]],
    };
  }

  if (st.step === "pl_wallet") {
    const wallets = accounts.filter((a) => a.currency === st.currency);
    return {
      text: `${head}\n\nකොයි wallet එකෙන්ද ගෙව්වේ?`,
      rows: [
        ...chunk(wallets.map((a) => ({ text: `${a.name} (${a.currency})`, callback_data: `w:${a.id.slice(0, 8)}` })), 2),
        [{ text: "Wallet නැතුව (record විතරක්)", callback_data: "w:none" }],
        [cancel],
      ],
    };
  }

  if (st.step === "lb_name") {
    return { text: `${head}\n\n✏️ කෙනාගේ නම type කරලා එවන්න.`, rows: [[cancel]] };
  }

  if (st.step === "lb_wallet") {
    const q = st.lbAction === "lent" || st.lbAction === "repaid_by_me"
      ? "කොයි wallet එකෙන්ද දුන්නේ?"
      : "කොයි wallet එකටද ලැබුණේ?";
    return {
      text: `${head}\n\n${q}`,
      rows: [
        ...walletButtons(accounts, "lw"),
        [{ text: "Wallet නැතුව (record විතරක්)", callback_data: "lw:none" }],
        [cancel],
      ],
    };
  }

  if (st.step === "lb_cur") {
    const currencies = [...new Set(accounts.map((a) => a.currency))];
    return {
      text: `${head}\n\nකරන්සිය තෝරන්න:`,
      rows: [...chunk(currencies.map((c) => ({ text: c, callback_data: `lc:${c}` })), 3), [cancel]],
    };
  }

  if (st.step === "lb_base") {
    return {
      text:
        `${head}\n\n✏️ ${esc(st.lbName ?? "")}ගේ ගිණුම තියෙන්නේ ${st.lbCurrency} වලින්. ` +
        `මේ මුදල ${st.lbCurrency} වලින් කීයද? type කරලා එවන්න.`,
      rows: [[cancel]],
    };
  }

  if (st.step === "amount") {
    const cur = from?.currency ?? st.currency ?? "";
    const full: Button[][] = st.type === "pl_pay" && (st.remaining ?? 0) > 0
      ? [[{ text: `සම්පූර්ණ ඉතිරිය: ${money(st.remaining!, cur)}`, callback_data: "pf" }]]
      : st.type === "lb_tx" && (st.lbOwed ?? 0) > 0 && cur === st.lbCurrency
      ? [[{ text: `සම්පූර්ණ ඉතිරිය: ${money(st.lbOwed!, cur)}`, callback_data: "lf" }]]
      : [];
    return {
      text: `${head}\n\n✏️ මුදල type කරලා එවන්න (${cur}). උදා: <code>1500</code>`,
      rows: [...full, [cancel]],
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
      kind: parent ? parent.kind : kindOf(st),
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
  [{ text: BTN_TRANSFER, callback_data: "m:tr" }, { text: BTN_PAYLATER, callback_data: "m:pl" }],
  [{ text: BTN_LEND, callback_data: "m:lb" }],
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

// ---------- Pay Later ----------

type Tab = { id: string; person_or_store: string; currency: string; amount: number; is_paid: boolean; due_date: string | null };

const sumAmounts = (rows: Tx[] | null) => round2((rows ?? []).reduce((n, r) => n + Number(r.amount), 0));

async function loadTabs(onlyUnpaid: boolean): Promise<Tab[]> {
  let q = admin
    .from("pay_later")
    .select("id, person_or_store, currency, amount, is_paid, due_date, created_at")
    .eq("user_id", USER_ID);
  if (onlyUnpaid) q = q.eq("is_paid", false);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tab[];
}

async function findTab(prefix: string): Promise<Tab | null> {
  return (await loadTabs(false)).find((t) => t.id.startsWith(prefix)) ?? null;
}

async function tabPaid(tabId: string): Promise<number> {
  const { data, error } = await admin.from("pay_later_payments").select("amount").eq("pay_later_id", tabId);
  if (error) throw error;
  return sumAmounts(data as Tx[]);
}

const PL_BACK: Button[][] = [[{ text: BTN_PAYLATER, callback_data: "m:pl" }, { text: BTN_MENU, callback_data: "m" }]];

async function payLaterList(): Promise<{ text: string; rows: Button[][] }> {
  const tabs = await loadTabs(true);
  const rows: Button[][] = [];
  const totals = new Map<string, number>();
  for (const t of tabs) {
    const remaining = Math.max(0, round2(Number(t.amount) - (await tabPaid(t.id))));
    totals.set(t.currency, (totals.get(t.currency) ?? 0) + remaining);
    rows.push([{ text: `${t.person_or_store} — ${money(remaining, t.currency)}`, callback_data: `pl:${t.id.slice(0, 8)}` }]);
  }
  rows.push([{ text: "➕ New tab", callback_data: "pl:new" }], ...BACK);
  const totalLines = [...totals].map(([c, n]) => `ගෙවන්න තියෙන මුළු ගණන ${c}: <b>${money(round2(n), c)}</b>`);
  const body = tabs.length
    ? `${totalLines.join("\n")}\n\nTab එකක් තෝරන්න:`
    : "ගෙවන්න තියෙන tab එකක්වත් නැහැ ✅";
  return { text: `<b>${BTN_PAYLATER}</b>\n\n${body}`, rows };
}

async function payLaterTab(tab: Tab): Promise<{ text: string; rows: Button[][] }> {
  const paid = await tabPaid(tab.id);
  const total = round2(Number(tab.amount));
  const remaining = Math.max(0, round2(total - paid));
  const { data: items, error } = await admin
    .from("pay_later_items")
    .select("description, amount, category, purchased_at, created_at")
    .eq("pay_later_id", tab.id)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  const itemLines = ((items ?? []) as Tx[]).map((i) =>
    `${shortDate(i.purchased_at)} · ${money(Number(i.amount))} · ${esc(i.category)}` +
    (i.description ? ` — ${esc(String(i.description).slice(0, 40))}` : ""));
  const id8 = tab.id.slice(0, 8);
  const actions: Button[] = [{ text: "➕ Purchase", callback_data: `pp:${id8}` }];
  if (remaining > 0) actions.push({ text: "💵 Pay", callback_data: `py:${id8}` });
  return {
    text:
      `🛒 <b>${esc(tab.person_or_store)}</b>${tab.is_paid ? " (settled)" : ""}\n\n` +
      `Total: ${money(total, tab.currency)}\nPaid: ${money(paid, tab.currency)}\n` +
      `Remaining: <b>${money(remaining, tab.currency)}</b>` +
      (tab.due_date ? `\nDue: ${shortDate(tab.due_date)}` : "") +
      (itemLines.length ? `\n\nඅන්තිම purchases:\n${itemLines.join("\n")}` : "\n\nතවම purchases නැහැ."),
    rows: [actions, ...PL_BACK],
  };
}

async function createTab(st: State): Promise<Tab> {
  const { data, error } = await admin
    .from("pay_later")
    .insert({ user_id: USER_ID, person_or_store: st.plName, currency: st.currency, amount: 0, description: "" })
    .select("id, person_or_store, currency, amount, is_paid, due_date")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  return data as Tab;
}

/** Add a purchase to a tab and refresh the tab total — no wallet is touched, same as the app. */
async function addPurchase(st: State): Promise<void> {
  if (!st.tabId || st.amount == null) throw new Error("incomplete purchase");
  const { error } = await admin.from("pay_later_items").insert({
    pay_later_id: st.tabId,
    user_id: USER_ID,
    description: st.description ?? "",
    amount: round2(st.amount),
    category: st.category ?? "Other",
    purchased_at: await todayForUser(),
  });
  if (error) throw error;
  const { data: items, error: e2 } = await admin.from("pay_later_items").select("amount").eq("pay_later_id", st.tabId);
  if (e2) throw e2;
  const { error: e3 } = await admin.from("pay_later").update({ amount: sumAmounts(items as Tx[]) }).eq("id", st.tabId);
  if (e3) throw e3;
}

/**
 * Record a payment on a tab — the app's rules: when a wallet is chosen the
 * payment becomes one expense per category it pays off (oldest purchases
 * first), the wallet is debited once for the whole payment, and the tab is
 * marked settled when payments cover its total. Anything written before a
 * failure is removed again.
 */
async function addPayment(st: State): Promise<void> {
  if (!st.tabId || st.amount == null) throw new Error("incomplete payment");
  const amount = round2(st.amount);
  const today = await todayForUser();
  const paidBefore = await tabPaid(st.tabId);

  const { data: pay, error } = await admin
    .from("pay_later_payments")
    .insert({ pay_later_id: st.tabId, user_id: USER_ID, amount, note: st.description ?? "", paid_at: today })
    .select("id")
    .single();
  if (error || !pay) throw error ?? new Error("insert failed");

  if (st.accountId) {
    const txIds: string[] = [];
    try {
      const { data: items, error: e1 } = await admin
        .from("pay_later_items")
        .select("amount, category, created_at")
        .eq("pay_later_id", st.tabId)
        .order("created_at", { ascending: true });
      if (e1) throw e1;

      const rangeStart = paidBefore;
      const rangeEnd = paidBefore + amount;
      const byCategory = new Map<string, number>();
      let cursor = 0;
      for (const item of (items ?? []) as Tx[]) {
        const itemStart = cursor;
        const itemEnd = cursor + Number(item.amount);
        cursor = itemEnd;
        const overlap = Math.min(itemEnd, rangeEnd) - Math.max(itemStart, rangeStart);
        if (overlap > 0) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + overlap);
      }
      const allocated = [...byCategory.values()].reduce((n, v) => n + v, 0);
      if (amount - allocated > 0.004) {
        byCategory.set("Pay Later", (byCategory.get("Pay Later") ?? 0) + (amount - allocated));
      }

      const description = `Pay Later: ${st.plName ?? ""}${st.description ? ` - ${st.description}` : ""}`;
      for (const [category, part] of byCategory) {
        if (part <= 0) continue;
        const { data: tx, error: e2 } = await admin
          .from("transactions")
          .insert({
            user_id: USER_ID,
            account_id: st.accountId,
            type: "expense",
            amount: round2(part),
            currency: st.currency ?? "LKR",
            category,
            description,
            date: today,
          })
          .select("id")
          .single();
        if (e2 || !tx) throw e2 ?? new Error("insert failed");
        txIds.push(tx.id as string);
      }
      await updateBalance(st.accountId, -amount);
    } catch (e) {
      for (const id of txIds) await admin.from("transactions").delete().eq("id", id);
      await admin.from("pay_later_payments").delete().eq("id", pay.id);
      throw e;
    }
  }

  const { data: tab } = await admin.from("pay_later").select("amount").eq("id", st.tabId).maybeSingle();
  const total = Number(tab?.amount ?? 0);
  if (total > 0 && (await tabPaid(st.tabId)) >= total) {
    await admin.from("pay_later").update({ is_paid: true, paid_at: new Date().toISOString() }).eq("id", st.tabId);
  }
}

async function startPayLater(chatId: number, messageId: number, type: "pl_new" | "pl_buy" | "pl_pay", tab?: Tab) {
  const accounts = await loadAccounts();
  const st: State = { step: "pl_name", type };
  if (tab) {
    st.tabId = tab.id;
    st.plName = tab.person_or_store;
    st.currency = tab.currency;
    if (type === "pl_pay") st.remaining = Math.max(0, round2(Number(tab.amount) - (await tabPaid(tab.id))));
  }
  const cats = type === "pl_buy" ? await loadCategories() : [];
  settle(st, accounts);
  await saveSession(chatId, st);
  const v = view(st, accounts, cats);
  await show(chatId, v.text, v.rows, messageId);
}

// ---------- Lend & Borrow ----------

type Contact = { id: string; person_name: string };
type LbTx = { type: LbAction; amount: number; currency: string; base_amount: number | null; description: string; date: string; created_at: string };

const LB_BACK: Button[][] = [[{ text: BTN_LEND, callback_data: "m:lb" }, { text: BTN_MENU, callback_data: "m" }]];

/** Same rules as the app: positive = they owe me, negative = I owe them, in the person's currency. */
function lbBalance(txs: LbTx[]): number {
  return round2(txs.reduce((sum, t) => {
    const a = Number(t.base_amount ?? t.amount);
    return t.type === "lent" || t.type === "repaid_by_me" ? sum + a : sum - a;
  }, 0));
}
/** The currency of the person's first lent/borrowed entry (null for a fresh person). */
function lbCurrencyOf(txs: LbTx[]): string | null {
  const firstFirst = [...txs].sort((a, b) => (a.date + a.created_at).localeCompare(b.date + b.created_at));
  return firstFirst.find((t) => t.type === "lent" || t.type === "borrowed")?.currency ?? null;
}
const lbStatus = (bal: number, cur: string | null) =>
  Math.abs(bal) < 0.005 ? "settled ✅"
    : bal > 0 ? `එයා මට ණය ${money(bal, cur ?? undefined)}`
    : `මම එයාට ණය ${money(-bal, cur ?? undefined)}`;

async function loadContacts(): Promise<{ contact: Contact; txs: LbTx[] }[]> {
  const { data: contacts, error } = await admin
    .from("lending_contacts")
    .select("id, person_name, created_at")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const { data: txs, error: e2 } = await admin
    .from("lending_transactions")
    .select("contact_id, type, amount, currency, base_amount, description, date, created_at")
    .eq("user_id", USER_ID)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (e2) throw e2;
  return ((contacts ?? []) as Contact[]).map((c) => ({
    contact: c,
    txs: ((txs ?? []) as Tx[]).filter((t) => t.contact_id === c.id) as LbTx[],
  }));
}

async function lendList(): Promise<{ text: string; rows: Button[][] }> {
  const all = await loadContacts();
  const rows: Button[][] = [];
  const owedToMe = new Map<string, number>();
  const iOwe = new Map<string, number>();
  for (const { contact, txs } of all) {
    const bal = lbBalance(txs);
    const cur = lbCurrencyOf(txs);
    if (cur && bal > 0) owedToMe.set(cur, (owedToMe.get(cur) ?? 0) + bal);
    if (cur && bal < 0) iOwe.set(cur, (iOwe.get(cur) ?? 0) - bal);
    const tag = Math.abs(bal) < 0.005 ? "✅" : bal > 0 ? `+${money(bal, cur ?? undefined)}` : `−${money(-bal, cur ?? undefined)}`;
    rows.push([{ text: `${contact.person_name} · ${tag}`, callback_data: `lp:${contact.id.slice(0, 8)}` }]);
  }
  rows.push([{ text: "➕ New person", callback_data: "lp:new" }], ...BACK);
  const lines = [
    ...[...owedToMe].map(([c, n]) => `මට ලැබෙන්න තියෙන්නේ (${c}): <b>${money(round2(n), c)}</b>`),
    ...[...iOwe].map(([c, n]) => `මම දෙන්න තියෙන්නේ (${c}): <b>${money(round2(n), c)}</b>`),
  ];
  const body = all.length
    ? `${lines.length ? lines.join("\n") : "ඔක්කොම settled ✅"}\n\n+ = එයා මට ණය · − = මම එයාට ණය\nකෙනෙක් තෝරන්න:`
    : "තවම කවුරුවත් නැහැ.";
  return { text: `<b>${BTN_LEND}</b>\n\n${body}`, rows };
}

async function lendPerson(id8: string): Promise<{ text: string; rows: Button[][] } | null> {
  const hit = (await loadContacts()).find((x) => x.contact.id.startsWith(id8));
  if (!hit) return null;
  const { contact, txs } = hit;
  const bal = lbBalance(txs);
  const cur = lbCurrencyOf(txs);
  const lines = txs.slice(0, 6).map((t) => {
    const label = { lent: "📤 Lent", borrowed: "📥 Borrowed", repaid_to_me: "✅ Repaid to me", repaid_by_me: "💵 I repaid" }[t.type];
    return `${shortDate(t.date)} · ${label} ${money(Number(t.amount), t.currency)}` +
      (t.description ? ` — ${esc(String(t.description).slice(0, 35))}` : "");
  });
  const id = contact.id.slice(0, 8);
  return {
    text:
      `🤝 <b>${esc(contact.person_name)}</b>\n\n${lbStatus(bal, cur)}` +
      (lines.length ? `\n\nඅන්තිම ගනුදෙනු:\n${lines.join("\n")}` : "\n\nතවම ගනුදෙනු නැහැ."),
    rows: [
      [{ text: LB_LABEL.lent, callback_data: `la:${id}:l` }, { text: LB_LABEL.borrowed, callback_data: `la:${id}:b` }],
      [{ text: LB_LABEL.repaid_to_me, callback_data: `la:${id}:t` }, { text: LB_LABEL.repaid_by_me, callback_data: `la:${id}:m` }],
      ...LB_BACK,
    ],
  };
}

async function startLend(chatId: number, messageId: number, id8: string, code: string) {
  const action = ({ l: "lent", b: "borrowed", t: "repaid_to_me", m: "repaid_by_me" } as Record<string, LbAction>)[code];
  const hit = (await loadContacts()).find((x) => x.contact.id.startsWith(id8));
  if (!action || !hit) return show(chatId, "ඒ කෙනාව හොයාගන්න බැරි උනා.", LB_BACK, messageId);
  const bal = lbBalance(hit.txs);
  const owed = action === "repaid_to_me" ? bal : action === "repaid_by_me" ? -bal : 0;
  const st: State = {
    step: "lb_wallet",
    type: "lb_tx",
    contactId: hit.contact.id,
    lbName: hit.contact.person_name,
    lbAction: action,
    lbCurrency: lbCurrencyOf(hit.txs),
    lbOwed: owed > 0.004 ? round2(owed) : undefined,
  };
  const accounts = await loadAccounts();
  settle(st, accounts);
  await saveSession(chatId, st);
  const v = view(st, accounts, []);
  await show(chatId, v.text, v.rows, messageId);
}

async function createContact(st: State): Promise<string> {
  const { data, error } = await admin
    .from("lending_contacts")
    .insert({ user_id: USER_ID, person_name: st.lbName, notes: "" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  return data.id as string;
}

/**
 * Record a lend/borrow entry the way the app does: the lending row, and when a
 * wallet is chosen, its balance change plus a "Lend & Borrow" transaction in
 * the main ledger. Anything written before a failure is removed again.
 */
async function addLending(st: State, accounts: Account[]): Promise<void> {
  if (!st.contactId || !st.lbAction || st.amount == null) throw new Error("incomplete entry");
  const wallet = accounts.find((a) => a.id === st.accountId);
  const currency = wallet?.currency ?? st.currency ?? st.lbCurrency ?? "LKR";
  const amount = round2(st.amount);
  const cross = st.lbCurrency != null && currency !== st.lbCurrency && st.base != null;
  const date = await todayForUser();

  const { data: row, error } = await admin
    .from("lending_transactions")
    .insert({
      user_id: USER_ID,
      contact_id: st.contactId,
      type: st.lbAction,
      amount,
      currency,
      exchange_rate: cross ? st.base! / amount : null,
      base_amount: cross ? round2(st.base!) : null,
      description: st.description ?? "",
      date,
      account_id: wallet?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !row) throw error ?? new Error("insert failed");
  if (!wallet) return;

  const out = st.lbAction === "lent" || st.lbAction === "repaid_by_me";
  const label = { lent: "Lent", borrowed: "Borrowed", repaid_to_me: "Repaid to me", repaid_by_me: "I repaid" }[st.lbAction];
  let txId: string | null = null;
  try {
    const { data: tx, error: e2 } = await admin
      .from("transactions")
      .insert({
        user_id: USER_ID,
        account_id: wallet.id,
        type: out ? "expense" : "income",
        amount,
        currency,
        category: "Lend & Borrow",
        description: [label, st.lbName, st.description].filter(Boolean).join(" — "),
        date,
      })
      .select("id")
      .single();
    if (e2 || !tx) throw e2 ?? new Error("insert failed");
    txId = tx.id as string;
    await updateBalance(wallet.id, out ? -amount : amount);
  } catch (e) {
    if (txId) await admin.from("transactions").delete().eq("id", txId);
    await admin.from("lending_transactions").delete().eq("id", row.id);
    throw e;
  }
}

async function onMenu(chatId: number, messageId: number, data: string) {
  if (data === "m") return show(chatId, MENU_TEXT, MENU_ROWS, messageId);
  if (data === "m:tr") return startEntry(chatId, "transfer", messageId);

  try {
    if (data === "m:pl") {
      const v = await payLaterList();
      return await show(chatId, v.text, v.rows, messageId);
    }
    if (data === "pl:new") return await startPayLater(chatId, messageId, "pl_new");
    if (data === "m:lb") {
      const v = await lendList();
      return await show(chatId, v.text, v.rows, messageId);
    }
    if (data === "lp:new") {
      const st: State = { step: "lb_name", type: "lb_new" };
      await saveSession(chatId, st);
      const v = view(st, [], []);
      return await show(chatId, v.text, v.rows, messageId);
    }
    if (data.startsWith("lp:")) {
      const v = await lendPerson(data.slice(3));
      if (!v) return await show(chatId, "ඒ කෙනාව හොයාගන්න බැරි උනා.", LB_BACK, messageId);
      return await show(chatId, v.text, v.rows, messageId);
    }
    if (data.startsWith("la:")) {
      const [, id8, code] = data.split(":");
      return await startLend(chatId, messageId, id8, code);
    }
    if (data.startsWith("pl:") || data.startsWith("pp:") || data.startsWith("py:")) {
      const tab = await findTab(data.slice(3));
      if (!tab) return await show(chatId, "ඒ tab එක හොයාගන්න බැරි උනා.", PL_BACK, messageId);
      if (data.startsWith("pp:")) return await startPayLater(chatId, messageId, "pl_buy", tab);
      if (data.startsWith("py:")) return await startPayLater(chatId, messageId, "pl_pay", tab);
      const v = await payLaterTab(tab);
      return await show(chatId, v.text, v.rows, messageId);
    }
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
      if (tx.category === "Lend & Borrow") {
        return await show(
          chatId,
          `↩️ <b>Undo last</b>\n\n${line}\n\nමේක Lend & Borrow ගනුදෙනුවක්. App එකේ Lend & Borrow එකෙන් ඒක delete කරන්න.`,
          BACK,
          messageId,
        );
      }
      if (String(tx.description ?? "").startsWith("Pay Later")) {
        return await show(
          chatId,
          `↩️ <b>Undo last</b>\n\n${line}\n\nමේක Pay Later payment එකක කොටසක්. App එකේ Pay Later එකෙන් ඒ payment එක delete කරන්න.`,
          BACK,
          messageId,
        );
      }
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
      if (
        !tx || !String(tx.id).startsWith(data.slice(2)) || tx.debt_id || tx.investment_id ||
        String(tx.description ?? "").startsWith("Pay Later") || tx.category === "Lend & Borrow"
      ) {
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
  if (!st || !["amount", "received", "note", "newcat_name", "pl_name", "lb_name", "lb_base"].includes(st.step)) {
    await sendMenu(chatId, "යට තියෙන බොත්තමකින් පටන් ගන්න: Expense, Income, Menu.");
    return;
  }

  const cats = st.type === "transfer" ? [] : await loadCategories();

  if (st.step === "note") {
    st.description = t.slice(0, 200);
  } else if (st.step === "pl_name") {
    if (t.startsWith("/")) return;
    st.plName = t.replace(/\s+/g, " ").slice(0, 60);
  } else if (st.step === "lb_name") {
    if (t.startsWith("/")) return;
    st.lbName = t.replace(/\s+/g, " ").slice(0, 60);
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
    if (st.type === "pl_pay" && st.remaining != null && n > st.remaining + 0.004) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `ඒක ඉතිරියට වඩා වැඩියි. ගෙවන්න තියෙන්නේ ${money(st.remaining, st.currency)} විතරයි. ආයෙ මුදල එවන්න.`,
      });
      return;
    }
    if (st.step === "amount") st.amount = n;
    else if (st.step === "lb_base") st.base = n;
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
  if (
    data === "m" || data.startsWith("m:") || data.startsWith("u:") ||
    data.startsWith("pl:") || data.startsWith("pp:") || data.startsWith("py:") ||
    data.startsWith("lp:") || data.startsWith("la:")
  ) {
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
      if (st.type === "pl_new") st.tabId = (await createTab(st)).id;
      else if (st.type === "pl_buy") await addPurchase(st);
      else if (st.type === "pl_pay") await addPayment(st);
      else if (st.type === "lb_new") st.contactId = await createContact(st);
      else if (st.type === "lb_tx") await addLending(st, accounts);
      else await postTransaction(st, accounts);
    } catch (e) {
      console.error("postTransaction", e);
      await tg("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: "⚠️ Save කරන්න බැරි උනා, කිසිම දෙයක් වෙනස් වෙලා නැහැ. ආයෙ උත්සාහ කරන්න.",
      });
      return;
    }
    if (st.contactId) {
      // Lend & Borrow: show the person (with their action buttons) under the receipt.
      const v = await lendPerson(st.contactId.slice(0, 8));
      await show(chatId, `✅ <b>Save උනා</b>\n\n${summary}`, [], messageId);
      if (v) await show(chatId, v.text, v.rows);
      return;
    }
    if (st.tabId) {
      // Pay Later: offer a way straight back to the tab.
      await show(
        chatId,
        `✅ <b>Save උනා</b>\n\n${summary}`,
        [[{ text: "🛒 Tab එක බලන්න", callback_data: `pl:${st.tabId.slice(0, 8)}` }], ...PL_BACK],
        messageId,
      );
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
  } else if (data.startsWith("pc:") && st.step === "pl_cur") {
    const cur = data.slice(3);
    if (!accounts.some((a) => a.currency === cur)) return;
    st.currency = cur;
  } else if (data === "pf" && st.step === "amount" && st.type === "pl_pay" && (st.remaining ?? 0) > 0) {
    st.amount = st.remaining;
  } else if (data === "w:none" && st.step === "pl_wallet") {
    st.noWallet = true;
  } else if (data.startsWith("w:") && st.step === "pl_wallet") {
    const acc = accounts.find((a) => a.id.startsWith(data.slice(2)) && a.currency === st.currency);
    if (!acc) return;
    st.accountId = acc.id;
  } else if (data === "lw:none" && st.step === "lb_wallet") {
    st.noWallet = true;
  } else if (data.startsWith("lw:") && st.step === "lb_wallet") {
    const acc = accounts.find((a) => a.id.startsWith(data.slice(3)));
    if (!acc) return;
    st.accountId = acc.id;
    st.currency = acc.currency;
  } else if (data.startsWith("lc:") && st.step === "lb_cur") {
    const cur = data.slice(3);
    if (!accounts.some((a) => a.currency === cur)) return;
    st.currency = cur;
  } else if (data === "lf" && st.step === "amount" && st.type === "lb_tx" && (st.lbOwed ?? 0) > 0) {
    st.amount = st.lbOwed;
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
