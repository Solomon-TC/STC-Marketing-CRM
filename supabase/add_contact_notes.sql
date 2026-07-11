-- Run this once in the Supabase SQL Editor to add the contact notes log.
-- Creates the new contact_notes table (purely additive) and migrates any
-- existing free-text contacts.notes value into it as that contact's first
-- log entry, so no existing notes are lost. contacts.notes itself is left
-- in place afterward (unused going forward, but not deleted).

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

insert into contact_notes (contact_id, body, created_at)
select id, notes, created_at from contacts
where notes is not null and trim(notes) <> '';
