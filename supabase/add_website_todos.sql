-- Run this once in the Supabase SQL Editor to add the To-Do page in the
-- Websites view. One new table, purely additive -- nothing existing is
-- touched. Deliberately separate from the sales-side `tasks` table (those
-- are tied to contacts and show on the Sales view's Tasks page).

create table website_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

alter table website_todos enable row level security;

create policy "authenticated users can do everything on website_todos"
  on website_todos for all to authenticated using (true) with check (true);
