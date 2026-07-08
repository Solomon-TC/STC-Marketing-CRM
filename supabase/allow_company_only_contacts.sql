-- Run this once in the Supabase SQL Editor against your existing project.
-- Lets contacts be imported with only a company name (no personal name),
-- matching a spreadsheet that only has company names.

alter table contacts alter column name drop not null;

alter table contacts add constraint contacts_name_or_company_present
  check (name is not null or company is not null);
