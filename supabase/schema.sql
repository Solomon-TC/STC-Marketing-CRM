-- STC Marketing CRM schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) once.

-- 1. Deal stage enum, matching your actual pipeline
-- Already have this project running with the old stage list? Don't run this
-- create statement (it'll fail with "already exists") -- instead run
-- add_fulfilled_obligation_stage.sql, then migrate_removed_pipeline_stages.sql.
-- cold_lead is only ever used by the Websites Pipeline (see WEBSITE_DEAL_STAGES
-- in lib/types.ts) -- the Spotlights Pipeline's own stage list omits it.
create type deal_stage as enum (
  'cold_lead',
  'warm_lead',
  'called_contacted',
  'requested_followup',
  'followed_up',
  'won',
  'fulfilled_obligation',
  'lost'
);

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
-- won_at records the first time a deal was moved to "won" (set by the app,
-- not the database) -- it's the timeline basis for the Finances charts.
create table deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  stage deal_stage not null default 'warm_lead',
  value numeric(12,2),
  expected_close_date date,
  won_at timestamptz,
  urgent boolean not null default false,
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

-- 10. Websites Pipeline
-- A second, independent pipeline with the exact same stages/structure as
-- the Spotlights pipeline (deals) and pulling from the same contacts, but
-- with its own data and no link to the Cards system. Tracks two dollar
-- amounts instead of one: a one-time initial value and a monthly
-- recurring value.
create table website_deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  stage deal_stage not null default 'warm_lead',
  initial_value numeric(12,2),
  recurring_value numeric(12,2),
  expected_close_date date,
  won_at timestamptz,
  urgent boolean not null default false,
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

-- 11. Finances
-- The Finances tab reads Won-or-better deals from both pipelines and needs
-- to update live, so both tables are added to Supabase's realtime
-- publication (RLS above still applies to what a client can actually read).
alter publication supabase_realtime add table deals;
alter publication supabase_realtime add table website_deals;

-- 12. Website client tracking
-- A completely independent system for tracking the *build* process for a
-- website client, separate from the sales-side website_deals pipeline
-- above. Deliberately has no foreign key to contacts/deals/website_deals --
-- see add_website_clients.sql for the full reasoning. Already have this
-- project running? Don't run this section -- run add_website_clients.sql
-- in the Supabase SQL Editor instead.
create type website_client_stage as enum (
  'new',
  'intake',
  'info_received',
  'building',
  'client_review',
  'revisions',
  'domain_setup',
  'live',
  'maintenance'
);

create table website_clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  stage website_client_stage not null default 'new',
  stage_changed_at timestamptz not null default now(),
  date_closed date,
  service_area text,
  scope_tags text[] not null default '{}',
  live_domain text,
  maintenance_status text not null default 'inactive'
    check (maintenance_status in ('active', 'inactive')),
  notes text,
  intake_token uuid not null default gen_random_uuid(),
  intake_business_description text,
  intake_services text,
  intake_service_area_details text,
  intake_selling_points text,
  intake_inspiration_urls text,
  intake_other_notes text,
  intake_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index website_clients_intake_token_idx on website_clients (intake_token);
create index website_clients_stage_idx on website_clients (stage);

create trigger website_clients_set_updated_at before update on website_clients
  for each row execute function set_updated_at();

-- Keeps "days stuck in this stage" accurate no matter what UI action (or
-- future code path) changes the stage.
create or replace function set_website_client_stage_changed_at()
returns trigger as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger website_clients_set_stage_changed_at before update on website_clients
  for each row execute function set_website_client_stage_changed_at();

create table website_client_photos (
  id uuid primary key default gen_random_uuid(),
  website_client_id uuid not null references website_clients(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index website_client_photos_client_idx on website_client_photos (website_client_id);

-- Templates are the editable master checklist; each client gets their own
-- copy at creation time so a later template edit never rewrites a client's
-- existing checklist history.
create table website_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table website_client_checklist_items (
  id uuid primary key default gen_random_uuid(),
  website_client_id uuid not null references website_clients(id) on delete cascade,
  category text not null,
  label text not null,
  sort_order int not null default 0,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index website_client_checklist_items_client_idx on website_client_checklist_items (website_client_id);

create table dns_reference_guides (
  id uuid primary key default gen_random_uuid(),
  registrar text not null,
  steps text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger dns_reference_guides_set_updated_at before update on dns_reference_guides
  for each row execute function set_updated_at();

-- Singleton row (id is always 1) so the "flag as stuck after N days"
-- threshold is adjustable from the Pipeline Dashboard, not hardcoded.
create table website_pipeline_settings (
  id smallint primary key default 1 check (id = 1),
  stuck_threshold_days int not null default 5
);

insert into website_pipeline_settings (id, stuck_threshold_days) values (1, 5);

alter table website_clients enable row level security;
alter table website_client_photos enable row level security;
alter table website_checklist_templates enable row level security;
alter table website_client_checklist_items enable row level security;
alter table dns_reference_guides enable row level security;
alter table website_pipeline_settings enable row level security;

create policy "authenticated users can do everything on website_clients"
  on website_clients for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything on website_client_photos"
  on website_client_photos for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything on website_checklist_templates"
  on website_checklist_templates for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything on website_client_checklist_items"
  on website_client_checklist_items for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything on dns_reference_guides"
  on dns_reference_guides for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything on website_pipeline_settings"
  on website_pipeline_settings for all to authenticated using (true) with check (true);

-- The Initial Build Prompt page: a singleton row (id is always 1) holding
-- the text pasted into a new Claude Code session to start a client's build.
create table website_build_prompt (
  id smallint primary key default 1 check (id = 1),
  content text not null default '',
  updated_at timestamptz not null default now()
);

insert into website_build_prompt (id, content) values (1, '');

create trigger website_build_prompt_set_updated_at before update on website_build_prompt
  for each row execute function set_updated_at();

alter table website_build_prompt enable row level security;

create policy "authenticated users can do everything on website_build_prompt"
  on website_build_prompt for all to authenticated using (true) with check (true);

-- Private bucket for intake photo uploads. No insert/update/delete policy
-- at all -- uploads go through the service-role key server-side (see
-- lib/supabase/admin.ts), bypassing storage RLS entirely, so there's no
-- client-side write path for this bucket, anon or authenticated.
insert into storage.buckets (id, name, public)
values ('website-client-uploads', 'website-client-uploads', false)
on conflict (id) do nothing;

create policy "authenticated users can read website client uploads"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'website-client-uploads');

-- Starting checklist template and DNS reference guides -- both freely
-- editable/addable/removable afterward from within the app.
insert into website_checklist_templates (category, label, sort_order) values
  ('Info gathering', 'Social media checked', 1),
  ('Info gathering', 'Google Business checked', 2),
  ('Info gathering', 'Current site reviewed', 3),
  ('Info gathering', 'Photos received', 4),
  ('Info gathering', 'Content received', 5),
  ('Post-build cleanup', 'AI content cleaned up', 6),
  ('Post-build cleanup', 'SEO meta descriptions added', 7),
  ('Post-build cleanup', 'Alt text added', 8),
  ('Post-build cleanup', 'Mobile responsiveness checked', 9),
  ('Domain setup', 'DNS/nameserver access obtained', 10),
  ('Domain setup', 'Domain pointed to Vercel', 11),
  ('Domain setup', 'SSL confirmed live', 12),
  ('Post-launch', 'Google Search Console submitted', 13),
  ('Post-launch', 'Contact form (Resend) configured and tested', 14),
  ('Post-launch', 'Client notified site is live', 15);

insert into dns_reference_guides (registrar, steps, sort_order) values
  ('GoDaddy', E'1. Log in to godaddy.com > My Products > find the domain > DNS.\n2. To point to Vercel: add an A record, host "@", value 76.76.21.21; add a CNAME record, host "www", value cname.vercel-dns.com.\n3. Remove any conflicting existing A/CNAME records on "@"/"www" first.\n4. Propagation is usually under an hour, can take up to 24-48h.', 1),
  ('Namecheap', E'1. Log in to namecheap.com > Domain List > Manage > Advanced DNS.\n2. To point to Vercel: add an A record, host "@", value 76.76.21.21; add a CNAME record, host "www", value cname.vercel-dns.com.\n3. Delete Namecheap''s default parking-page records first.\n4. Propagation is usually under an hour, can take up to 24-48h.', 2),
  ('Wix', E'1. Wix domains are trickier -- Wix often wants to keep hosting DNS itself.\n2. In Wix: Settings > Domains > find the domain > Advanced DNS settings.\n3. Add an A record for "@" pointing to 76.76.21.21 and a CNAME for "www" pointing to cname.vercel-dns.com, replacing any existing Wix hosting records.\n4. If the client wants to keep any Wix-hosted email, don''t touch MX records.', 3),
  ('Squarespace', E'1. In Squarespace: Settings > Domains > select the domain > DNS Settings.\n2. Add an A record for "@" pointing to 76.76.21.21 and a CNAME for "www" pointing to cname.vercel-dns.com.\n3. Remove Squarespace''s default hosting A/CNAME records first.\n4. If the domain was bought through Squarespace, this is usually straightforward; if it''s an external domain just pointed at Squarespace, log in to the actual registrar instead.', 4),
  ('Previous web person owns the domain', E'1. Get the client to request access/transfer directly from the previous person in writing (email) -- don''t contact that person yourself first.\n2. Ideally get the domain transferred into the client''s own registrar account. If that stalls, ask the previous person to just update the DNS records (A/CNAME above) without a full transfer.\n3. If unresponsive after a reasonable follow-up window, check who the registrar is via a WHOIS lookup and have the client contact the registrar directly about regaining access to their own domain.\n4. Set expectations with the client that this step is the most likely to cause a launch delay.', 5);
