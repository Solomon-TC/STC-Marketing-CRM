-- Run this once in the Supabase SQL Editor to add the Finances tab's
-- backing data. Purely additive: two nullable columns, a one-time backfill,
-- and enabling realtime replication on two existing tables. Nothing else is
-- touched.

-- won_at records when a deal was moved to "won"; the app sets it going
-- forward. For deals already sitting in won/fulfilled_obligation before this
-- feature existed, there's no precise historical date, so this backfills
-- with updated_at as the closest available approximation -- otherwise those
-- deals would count toward the Finances totals but never appear on the
-- "value over time" chart.
alter table deals add column if not exists won_at timestamptz;
alter table website_deals add column if not exists won_at timestamptz;

update deals set won_at = updated_at
  where stage in ('won', 'fulfilled_obligation') and won_at is null;
update website_deals set won_at = updated_at
  where stage in ('won', 'fulfilled_obligation') and won_at is null;

-- Lets the Finances page update live via Supabase Realtime instead of
-- requiring a manual refresh. If either line below errors saying the table
-- is already a member of the publication, that's fine -- it just means
-- realtime was already turned on for that table; skip it and move on.
alter publication supabase_realtime add table deals;
alter publication supabase_realtime add table website_deals;
