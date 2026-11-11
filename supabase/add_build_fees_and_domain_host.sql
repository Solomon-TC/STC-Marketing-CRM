-- Run this once in the Supabase SQL Editor. Purely additive: three new,
-- empty, nullable columns on website_clients, and website_clients joins the
-- realtime publication so the Finances page updates live from it. No
-- existing row or column is changed.

alter table website_clients add column if not exists build_fee numeric(12,2);
alter table website_clients add column if not exists monthly_fee numeric(12,2);
-- Where the client's domain is registered/hosted (e.g. GoDaddy, Namecheap).
alter table website_clients add column if not exists domain_host text;

-- If this line errors saying website_clients is already a member of the
-- publication, that's fine -- realtime was already on; nothing else to do.
alter publication supabase_realtime add table website_clients;
