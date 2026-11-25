-- Run psql as the selected relay database's owner with -v observer_role=<dedicated-role>.
-- The role must already exist. Each environment uses a different role/database.
\set ON_ERROR_STOP on
\if :{?observer_role}
\else
\echo 'Set observer_role to the dedicated monitoring database role'
\quit 1
\endif
SELECT current_database() AS monitoring_database \gset
BEGIN;
REVOKE ALL ON DATABASE :"monitoring_database" FROM :"observer_role";
GRANT CONNECT ON DATABASE :"monitoring_database" TO :"observer_role";
REVOKE ALL ON SCHEMA public FROM :"observer_role";
GRANT USAGE ON SCHEMA public TO :"observer_role";
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"observer_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"observer_role";
GRANT SELECT ON relay_sync_projects, relay_sync_documents, relay_sync_updates,
  relay_sync_states, relay_sync_blobs TO :"observer_role";
ALTER ROLE :"observer_role" SET default_transaction_read_only = on;
ALTER ROLE :"observer_role" SET statement_timeout = '10s';
ALTER ROLE :"observer_role" SET lock_timeout = '3s';
ALTER ROLE :"observer_role" CONNECTION LIMIT 2;
COMMIT;
