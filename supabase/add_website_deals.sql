-- Run this once in the Supabase SQL Editor to add the Websites Pipeline.
-- Purely additive -- creates one new table and its RLS policy, does not
-- touch contacts, deals, tasks, cards, card_slots, or contact_notes.
--
-- Reuses the existing deal_stage enum and set_updated_at() trigger function,
-- so the Websites Pipeline has the exact same stages as the Spotlights
-- pipeline. It has no foreign key to cards/card_slots at all, by design.
create table website_deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  stage deal_stage not null default 'warm_lead',
  initial_value numeric(12,2),
  recurring_value numeric(12,2),
  expected_close_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index website_deals_contact_idx on website_deals (contact_id);
create index website_deals_stage_idx on website_deals (stage);

create trigger website_deals_set_updated_at before update on website_deals
  for each row execute function set_updated_at();

alter table website_deals enable row level security;

create policy "authenticated users can do everything on website_deals"
  on website_deals for all
  to authenticated
  using (true)
  with check (true);
