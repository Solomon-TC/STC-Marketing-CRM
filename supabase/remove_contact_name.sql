-- Run this once in the Supabase SQL Editor. Removes the unused "name" field
-- from contacts -- company is the sole identifier now. Safe on existing
-- data: the column and its check constraint are simply dropped, nothing
-- else is rewritten.
alter table contacts drop constraint if exists contacts_name_or_company_present;
alter table contacts drop column if exists name;
