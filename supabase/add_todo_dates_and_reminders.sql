-- Run this once in the Supabase SQL Editor. Purely additive -- no existing
-- row is changed or removed.
--
-- 1. website_todos.due_date: an optional date for personal to-dos so they
--    show on the To-Do calendar. Existing to-dos stay undated.
-- 2. reminder_checks: the recurring To-Do reminders (2nd-Wednesday client
--    update, weekly Maintenance check) are worked out from the calendar in
--    the app; this table only records which dates were ticked off. One row
--    per reminder per date; unticking removes that row.

alter table website_todos add column if not exists due_date date;

create table if not exists reminder_checks (
  reminder text not null,
  due_on date not null,
  done_at timestamptz not null default now(),
  primary key (reminder, due_on)
);

alter table reminder_checks enable row level security;

create policy "authenticated users can do everything on reminder_checks"
  on reminder_checks for all to authenticated using (true) with check (true);
