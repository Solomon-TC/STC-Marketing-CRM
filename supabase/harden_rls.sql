-- Run this once in the Supabase SQL Editor to tighten the RLS policies on an
-- already-created project (schema.sql only applies this on fresh installs).
--
-- What this changes: the original policies used `auth.role() = 'authenticated'`
-- inside USING/WITH CHECK, which is correct but leaves the policy attached to
-- every Postgres role (including anon). This rewrites them with `to authenticated`,
-- so Postgres rejects anon/unauthenticated requests before evaluating the row
-- check at all -- same behavior, stricter enforcement.

drop policy if exists "authenticated users can do everything on contacts" on contacts;
create policy "authenticated users can do everything on contacts"
  on contacts for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users can do everything on deals" on deals;
create policy "authenticated users can do everything on deals"
  on deals for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users can do everything on tasks" on tasks;
create policy "authenticated users can do everything on tasks"
  on tasks for all
  to authenticated
  using (true)
  with check (true);
