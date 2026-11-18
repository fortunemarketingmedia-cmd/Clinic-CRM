\set ON_ERROR_STOP on
\getenv runtime_password DB_RUNTIME_PASSWORD
BEGIN;
SELECT 'CREATE ROLE revive_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 40'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'revive_runtime') \gexec
ALTER ROLE revive_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 40 PASSWORD :'runtime_password';
SELECT NOT EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='revive_runtime') AS safe_role \gset
\if :safe_role
\else
  \echo 'Runtime role has unexpected memberships'
  SELECT 1/0;
\endif
REVOKE CREATE ON SCHEMA public FROM PUBLIC, revive_runtime;
GRANT USAGE ON SCHEMA public TO revive_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO revive_runtime;
REVOKE ALL ON TABLE public._prisma_migrations FROM revive_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO revive_runtime;
COMMIT;
