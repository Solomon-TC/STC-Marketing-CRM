-- STC Marketing CRM schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) once.

-- 1. Deal stage enum, matching your actual pipeline
create type deal_stage as enum (
  'cold_lead',
  'warm_lead',
  'called_contacted',
  'requested_followup',
  'follow_up',
  'won',
  'lost',
  'invoice_sent',
  'invoice_received',
  'ad_made',
  'ad_confirmed'
);

-- Stage names were reworked to match the real sales process. Renaming enum
-- values (rather than dropping/recreating the type or table) keeps every
-- existing deal row intact -- a deal with stage = 'follow_up' automatically
-- reads as 'followed_up' after this runs, no data rewrite needed.
--
-- Setting up fresh: running this whole file top-to-bottom handles both the
-- create and the rename, so you end up with the correct final names.
-- Already have this project running: run ONLY these two lines below in the
-- SQL Editor -- the create type above would fail with "already exists".
alter type deal_stage rename value 'follow_up' to 'followed_up';
alter type deal_stage rename value 'invoice_received' to 'payment_received';

-- 2. Contacts
-- Company is the sole identifier (no personal "name" field -- see
-- remove_contact_name.sql for the migration on an existing project).
-- notes is legacy free text, superseded by the contact_notes log below;
-- kept in place for existing data but no longer read or written by the app.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  company text,
  email text,
  phone text,
  industry text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_industry_idx on contacts (industry);
create index contacts_location_idx on contacts (location);

-- 3. Deals
create table deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  stage deal_stage not null default 'cold_lead',
  value numeric(12,2),
  expected_close_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_contact_idx on deals (contact_id);
create index deals_stage_idx on deals (stage);

-- 4. Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index tasks_contact_idx on tasks (contact_id);
create index tasks_due_idx on tasks (due_date);

-- 5. updated_at trigger helper
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_set_updated_at before update on contacts
  for each row execute function set_updated_at();

create trigger deals_set_updated_at before update on deals
  for each row execute function set_updated_at();

-- 6. Row Level Security
-- Both of you log in as authenticated Supabase users and share full access.
-- No per-owner restrictions, per your call on ownership.
alter table contacts enable row level security;
alter table deals enable row level security;
alter table tasks enable row level security;

create policy "authenticated users can do everything on contacts"
  on contacts for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can do everything on deals"
  on deals for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can do everything on tasks"
  on tasks for all
  to authenticated
  using (true)
  with check (true);

-- No policy is defined for the anon/public role, so unauthenticated requests
-- (including direct calls to the Supabase API using only the anon key) are
-- denied by default now that RLS is enabled above.

-- 7. Card management
-- A "card" is one physical 9x12 postcard mailer for a specific city/month,
-- made up of ad slots that local businesses buy. Self-contained from the
-- rest of the schema aside from card_slots' optional link to a contact.
create table cards (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  month date not null,
  status text not null default 'filling'
    check (status in ('filling', 'ready', 'sent', 'archived')),
  notes text,
  created_at timestamptz not null default now()
);

create index cards_status_idx on cards (status);
create index cards_month_idx on cards (month);

create table card_slots (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  slot_type text not null
    check (slot_type in ('half', 'regular', 'double', 'half_page')),
  price integer not null,
  business_name text,
  -- Deleting the CRM contact should not erase the sold slot, so this
  -- unlinks rather than cascading.
  contact_id uuid references contacts(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'filled')),
  created_at timestamptz not null default now()
);

create index card_slots_card_idx on card_slots (card_id);
create index card_slots_contact_idx on card_slots (contact_id);

-- 8. Row Level Security for card management
-- Same shared-access model as the rest of the app: any authenticated user
-- can do everything, no per-owner restrictions.
alter table cards enable row level security;
alter table card_slots enable row level security;

create policy "authenticated users can do everything on cards"
  on cards for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can do everything on card_slots"
  on card_slots for all
  to authenticated
  using (true)
  with check (true);

-- 9. Contact notes log
-- Every note is its own timestamped entry (not one big free-text field), so
-- there's a real history of contact activity -- newest first in the app.
create table contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index contact_notes_contact_idx on contact_notes (contact_id);

alter table contact_notes enable row level security;

create policy "authenticated users can do everything on contact_notes"
  on contact_notes for all
  to authenticated
  using (true)
  with check (true);
