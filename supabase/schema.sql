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
-- name is optional: bulk imports from a spreadsheet with only company names
-- are supported, so every contact needs at least a name or a company.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  company text,
  email text,
  phone text,
  industry text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_name_or_company_present check (name is not null or company is not null)
);

create index contacts_industry_idx on contacts (industry);
create index contacts_location_idx on contacts (location);
create index contacts_name_idx on contacts (name);

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
