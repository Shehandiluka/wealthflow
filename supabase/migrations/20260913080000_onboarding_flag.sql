-- Tracks whether a user has seen the app walkthrough. Defaults to false for
-- everyone — including existing users — so it's shown once on next login,
-- not just to brand-new signups.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_seen_onboarding boolean NOT NULL DEFAULT false;
