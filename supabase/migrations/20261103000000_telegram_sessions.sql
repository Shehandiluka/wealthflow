-- Holds the half-finished Telegram entry (amount, chosen type/currency/wallet/category)
-- between button taps. Only the edge function (service role) uses it.
create table if not exists public.telegram_sessions (
  chat_id    bigint primary key,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.telegram_sessions enable row level security;
-- Intentionally NO policies: with RLS on and no policy, the app/API keys can't read or write it.
revoke all on public.telegram_sessions from anon, authenticated;
