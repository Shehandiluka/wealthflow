# WealthFlow

Multi-currency personal wealth-management PWA. React + Vite + TypeScript +
Tailwind on the frontend, Supabase (Postgres, Auth, Storage, Edge Functions)
on the backend. This codebase was originally built in Lovable; all
Lovable-specific tooling, auth proxying, and AI-gateway calls have been
removed so it can be developed, hosted, and deployed independently.

---

## 1. Local development

```bash
npm install
npm run dev
```

`.env` already has your Supabase project URL and public anon key (these are
safe to expose client-side — they're what Supabase's row-level-security
rules are designed for).

## 2. What changed when this was de-Lovable-ified

- Removed `@lovable.dev/cloud-auth-js` and `lovable-tagger` — Google sign-in
  now calls `supabase.auth.signInWithOAuth()` directly. **You'll need to set
  up your own Google OAuth client** in Supabase Dashboard → Authentication →
  Providers → Google (previously this went through Lovable's managed OAuth
  app). Email/password sign-in was already plain Supabase and needs no
  changes.
- Removed the `componentTagger` Vite plugin (a Lovable editor-only dev tool).
- The `scan-receipt` and `sms-import` Edge Functions called
  `ai.gateway.lovable.dev` (Lovable's billed AI proxy). Both now call
  **OpenRouter** (`openrouter.ai`) instead, using the same
  OpenAI-compatible request format, so the model names (e.g.
  `google/gemini-2.5-flash`) carry over unchanged. Set an `OPENROUTER_API_KEY`
  secret in your Supabase project (Edge Functions → Secrets) to re-enable
  these — `sms-import` degrades gracefully to its regex-only parser without
  a key; `scan-receipt` needs one to function at all.
- Removed hardcoded references to the old `radiant-cash-map.lovable.app`
  domain (in `index.html`, `robots.txt`, the sitemap generator, and `Seo.tsx`)
  — these now default to a placeholder and read `VITE_SITE_URL` if you set
  one, so update that once you have a real domain.
- Removed the `.lovable/` folder (Lovable's internal planning notes — not
  needed outside the Lovable editor).

## 3. Deploying to Cloudflare Workers

### Windows — double-click, no typing

Double-click **`deploy.bat`** in this folder. It installs everything it
needs, opens a browser once so you can log into (or create) a Cloudflare
account, then builds and deploys. At the end it prints your live link,
something like `https://wealthflow.<your-subdomain>.workers.dev` — open
that on any device. Run it again any time you want to push a new version.

Requires [Node.js](https://nodejs.org) (LTS version) to be installed on the
computer first — the script checks for it and tells you if it's missing.

### Mac/Linux/terminal — one command

This app is a pure client-side SPA (it talks to Supabase directly from the
browser — no server-rendering, no backend Worker needed), so it deploys as a
**Workers Static Assets** site. Everything's already wired up in
`wrangler.jsonc` (project name: `wealthflow`) and `package.json`.

```bash
npm install        # first time only
npm run deploy
```

or, if you want the login check handled for you automatically:

```bash
./scripts/deploy.sh
```

What happens:
- **First run:** if you're not logged in yet, a browser tab opens once to
  authorize your Cloudflare account (`wrangler login`). If this is your
  Cloudflare account's very first Worker, it may also ask you to pick a
  free `*.workers.dev` subdomain — a one-time, whole-account setting.
- Cloudflare doesn't have a project named `wealthflow` yet, so Wrangler
  **creates it automatically** on this first deploy — you don't need to
  create anything by hand in the dashboard first.
- Every run after that just builds and re-deploys to the same project —
  genuinely one command, no browser interaction needed once you're logged in.
- At the end, Wrangler prints your live URL:
  `https://wealthflow.<your-subdomain>.workers.dev` — that's the link you
  open on your phone/browser to use the app. It talks straight to your
  existing Supabase project from there.

Want a custom domain instead of the `workers.dev` one later? Cloudflare
dashboard → Workers & Pages → `wealthflow` → Settings → Domains & Routes.

Your Supabase URL/key are baked in at build time from `.env` — nothing
extra to configure on the Cloudflare side for those.

(There's also an official `@cloudflare/vite-plugin` for tighter dev-server
integration — it currently requires Vite 6+, while this project is on Vite 5
for compatibility with its existing plugins. Worth adopting later if you
add a Cloudflare-side backend Worker, but not needed for this static deploy.)

## 4. Backend — Supabase

This project moved off the original Lovable-connected project to your own
Supabase project (`ontlcjvmztiprmzbtcmh`). `.env` already points at it.

**Found during this round:** `process-recurring` and `process-draft-reminders`
were deployed as edge functions but **nothing was ever scheduled to call
them** — recurring transactions and draft reminders never fired on their
own. A new migration schedules both via `pg_cron` (daily and hourly). As a
stopgap while that migration hadn't been applied yet, adding a recurring
rule used to fire an initial transaction immediately on creation — that was
actually a bug (it fired regardless of how far away the real due date was,
e.g. charging a loan's first EMI the moment you added the debt), now
removed. A **"Process Due Now"** button was added to the Recurring page as
a manual fallback either way.

### Applying database migrations — double-click, no typing

Double-click **`migrate.bat`**. It connects directly to your database (no
Supabase CLI login needed — just the Session pooler connection string and
your DB password, same as `restore.bat`), checks which migrations are
**already applied**, and shows you **only the new ones** — you pick exactly
which to apply (a single one, a few, or all). It never re-runs anything
already applied.

### Manual / command-line equivalent

If you'd rather use the Supabase CLI directly:

```bash
npx supabase login
npx supabase link --project-ref ontlcjvmztiprmzbtcmh
npx supabase db push --include-all
npx supabase functions deploy scan-receipt
npx supabase functions deploy sms-import
npx supabase functions deploy send-debt-reminders
npx supabase functions deploy send-budget-alerts
```

`--include-all` matters here specifically because this project's migration
timestamps aren't perfectly sequential (a couple were added after ones with
later dates already existed remotely) — without it, `db push` refuses to
apply anything until you pass the flag, as a safety check.

## 5. Push notifications (loan due-dates, and budget limits)

New since the last round — a real, working Web Push setup, not just an in-app badge.

**One-time setup:**

1. A fresh VAPID keypair has already been generated for you:
   - Public key — already in `.env` as `VITE_VAPID_PUBLIC_KEY` (safe to expose, it's
     baked into the frontend build).
   - Private key — **never put this in `.env` or commit it.** Add it as a Supabase
     Edge Function secret instead:
     ```bash
     npx supabase secrets set VAPID_PRIVATE_KEY=BWGKwroS6DfJxHTmZxmrbKZd0F_iNmyxEYxYa-iUg3Q
     npx supabase secrets set VAPID_PUBLIC_KEY=BCYJEopstLbp0m-g1CokZ-oU9pMQH0soY2QqUrzryZeuDITZ3Qy-lyppmjnRtIImn6Bad6W1x9nOuT0sV5ToRUg
     npx supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
     ```
     (If you'd rather generate your own keypair instead of reusing the one above —
     reasonable, since it passed through this chat — run
     `npx web-push generate-vapid-keys` and swap both values.)

2. Deploy the function (see command above) and run `migrate.bat` (or
   `supabase db push`), which creates `push_subscriptions` and
   `debt_reminder_log`.

3. Schedule it to actually run — open `supabase/cron-notifications-template.sql`,
   fill in your `CRON_SECRET` value where marked, and paste the whole file into
   the Supabase Dashboard → SQL Editor → Run. This schedules both the loan
   reminder job and the budget-alert job (80%/100% of a category's monthly
   limit) in one go. (`pg_cron` and `pg_net` are already enabled by an
   earlier migration.) This one's a manual step deliberately — a wrong
   secret here fails silently forever, so it's safer than baking a
   guessable placeholder into an auto-applied migration.

4. Deploy the new function too: `npx supabase functions deploy send-budget-alerts`.

4. In the app, go to **Settings → Notifications** and turn on "Loan due-date
   reminders" — this asks the browser for notification permission and saves a
   push subscription tied to your account. Do this on each device you want
   reminders on.

How it works: the cron job hits the edge function daily; it checks every
active loan's due date, and for anything due within 3 days (or due today) it
sends a push to every device you've subscribed, once per day per loan (so it
won't nag you hourly). If a browser has revoked a subscription, the function
notices the failed send and cleans it up automatically.

## 6. Project structure

- `src/pages/` — route-level pages (Dashboard, Accounts, Transactions, Auth, etc.)
- `src/integrations/supabase/` — Supabase client + generated DB types
- `src/sw.ts` — custom service worker (PWA precaching + Web Push handling)
- `src/components/`, `src/hooks/`, `src/contexts/`, `src/lib/` — shared app code
- `supabase/migrations/` — database schema history
- `supabase/functions/` — Edge Functions (receipt scanning, SMS import, recurring transactions, draft reminders, exchange rates, push reminders)
