-- Run this once in the Supabase SQL Editor to add the Card Management
-- feature to your existing project. Purely additive -- creates two new
-- tables and their RLS policies, does not touch contacts/deals/tasks.

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
  contact_id uuid references contacts(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'filled')),
  created_at timestamptz not null default now()
);

create index card_slots_card_idx on card_slots (card_id);
create index card_slots_contact_idx on card_slots (contact_id);

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
