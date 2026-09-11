#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v migration_password="$MIGRATION_PASSWORD" -v runtime_password="$RUNTIME_PASSWORD" <<'SQL'
CREATE ROLE study_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'migration_password';
CREATE ROLE study_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'runtime_password';
ALTER DATABASE study OWNER TO study_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE study FROM PUBLIC;
GRANT CONNECT ON DATABASE study TO study_migrator, study_runtime;
CREATE DATABASE study_test OWNER study_migrator;
REVOKE ALL ON DATABASE study_test FROM PUBLIC;
GRANT CONNECT ON DATABASE study_test TO study_migrator, study_runtime;
SQL
