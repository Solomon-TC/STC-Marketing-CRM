-- Run this once in the Supabase SQL Editor to add the "Urgent" flag used by
-- both pipelines. Purely additive: two new boolean columns, defaulting to
-- false, so every existing deal is simply "not urgent" until someone checks
-- the box. Nothing else is touched.

alter table deals add column if not exists urgent boolean not null default false;
alter table website_deals add column if not exists urgent boolean not null default false;
