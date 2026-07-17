-- STEP 2 of 2 for the pipeline rework. Run this only after
-- add_fulfilled_obligation_stage.sql has completed successfully (as a
-- separate query -- see that file for why).
--
-- cold_lead, invoice_sent, payment_received, ad_made, and ad_confirmed are
-- being removed from the pipeline UI. Postgres can't drop enum values, so
-- those old values stay defined on the deal_stage type (harmless, just
-- unused) -- but any deal actually sitting in one of them needs to move
-- somewhere the UI still shows, or it would silently disappear from the
-- board. cold_lead deals go back to warm_lead (the new first stage); the
-- post-won stages all collapse into fulfilled_obligation.
update deals set stage = 'warm_lead' where stage = 'cold_lead';
update deals set stage = 'fulfilled_obligation'
  where stage in ('invoice_sent', 'payment_received', 'ad_made', 'ad_confirmed');
