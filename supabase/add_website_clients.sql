-- Run this once in the Supabase SQL Editor to add website-build tracking.
-- Entirely new tables/types/bucket -- nothing existing (contacts, deals,
-- website_deals, cards, tasks, etc.) is touched, read, or modified in any
-- way. Safe to run against a database with real client data in it.

-- 1. Website client pipeline stage
-- A separate enum from deal_stage on purpose -- this tracks the build
-- process (new -> intake -> ... -> live -> maintenance), a completely
-- different lifecycle than a sales-pipeline deal stage.
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

-- 2. Website clients
-- Deliberately independent of contacts/deals/website_deals -- no foreign
-- key to the sales side. Created manually once your brother closes someone
-- who needs a website; business/contact info is re-entered here rather
-- than linked, since this table tracks a different process end-to-end.
--
-- intake_token is the secret in the public intake link
-- (/intake/<intake_token>) -- unguessable, and is the only thing that page
-- is allowed to look up by.
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
-- future code path) changes the stage -- it can't drift out of sync the
-- way an app-code-only timestamp could.
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

-- 3. Intake photos
-- Metadata only -- the actual file bytes live in the storage bucket
-- created below, addressed by storage_path.
create table website_client_photos (
  id uuid primary key default gen_random_uuid(),
  website_client_id uuid not null references website_clients(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index website_client_photos_client_idx on website_client_photos (website_client_id);

-- 4. Checklist templates + per-client checklist items
-- Templates are the editable master list (add/remove/rename items any time
-- via the app). Each client gets their own COPY of the current active
-- templates at creation time, so editing the template later never rewrites
-- a client's existing checklist history.
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

-- 5. DNS / registrar reference guides
-- Not tied to any client -- a small internal reference, editable over time
-- as you run into new registrars/scenarios.
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

-- 6. Pipeline settings
-- Singleton row (id is always 1) so the "flag as stuck after N days"
-- threshold is adjustable from the Pipeline Dashboard itself, not hardcoded.
create table website_pipeline_settings (
  id smallint primary key default 1 check (id = 1),
  stuck_threshold_days int not null default 5
);

insert into website_pipeline_settings (id, stuck_threshold_days) values (1, 5);

-- 7. Row Level Security
-- Same shared-access model as the rest of the app: any authenticated user
-- (you or your brother) can do everything, no per-owner restrictions. No
-- policy for anon/public -- the intake page never talks to these tables
-- with the anon key. It goes through a server-only route using the
-- service-role key, which bypasses RLS entirely, so real client data here
-- is never exposed to an unauthenticated request.
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

-- 8. Storage bucket for intake photo uploads
-- Private bucket. No insert/update/delete policy at all -- the intake
-- form's photo upload goes through the service-role key server-side
-- (bypasses storage RLS), so there is no client-side write path, anon or
-- authenticated. Authenticated users can read (to display photos in the
-- client detail view).
insert into storage.buckets (id, name, public)
values ('website-client-uploads', 'website-client-uploads', false)
on conflict (id) do nothing;

create policy "authenticated users can read website client uploads"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'website-client-uploads');

-- 9. Seed data -- starting checklist template and DNS reference guides.
-- Both are freely editable/addable/removable afterward from within the app.
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
