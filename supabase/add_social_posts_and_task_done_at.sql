-- Run this once in the Supabase SQL Editor. Purely additive -- no existing
-- row is changed or removed.
--
-- 1. tasks.done_at: when a contact task was checked off, so the To-Do page
--    can hide completed items 5 days later (website_todos already has this
--    column). Existing rows just get an empty value.
-- 2. social_posts: the Dashboard's daily "posted on social media" check.
--    One row per day it was checked; no row for today means unchecked, so
--    it resets on its own every day.

alter table tasks add column if not exists done_at timestamptz;

create table if not exists social_posts (
  posted_on date primary key,
  created_at timestamptz not null default now()
);

alter table social_posts enable row level security;

create policy "authenticated users can do everything on social_posts"
  on social_posts for all to authenticated using (true) with check (true);
