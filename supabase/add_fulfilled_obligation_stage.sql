-- STEP 1 of 2 for the pipeline rework. Run this alone first, then run
-- migrate_removed_pipeline_stages.sql as a separate query afterward.
--
-- Postgres won't let a brand-new enum value be used in the same transaction
-- it was added in, so these two steps have to be run as separate queries in
-- the SQL Editor (not pasted together and run at once).
alter type deal_stage add value if not exists 'fulfilled_obligation' after 'won';
