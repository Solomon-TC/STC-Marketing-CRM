-- Run this once in the Supabase SQL Editor to add the Initial Build Prompt
-- page. One new table, purely additive -- nothing existing is touched.

-- Singleton row (id is always 1), same pattern as website_pipeline_settings.
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
