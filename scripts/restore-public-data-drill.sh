#!/usr/bin/env bash
# Run only inside a disposable CI runner, against its localhost Supabase container.
set -euo pipefail
test "${GITHUB_ACTIONS:-}" = true
started=$SECONDS
(cd backup && sha256sum --check --quiet SHA256SUMS)
trap 'supabase stop --no-backup >/dev/null' EXIT
supabase start -x studio,imgproxy,edge-runtime,realtime,storage-api,postgrest,gotrue,inbucket,logflare,vector,supavisor >/dev/null
export PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
# The SQL stream contains private data. Suppress PostgreSQL error context in CI logs.
{
  echo 'begin; set local session_replication_role=replica;'
  awk '/^COPY "public"\."[^"]+" / {keep=1} keep {print} keep && $0=="\\." {keep=0}' backup/data.sql
  echo 'commit;'
} | psql -Xq -v ON_ERROR_STOP=1 >/dev/null 2>drill-errors.log || { echo 'Restore failed while loading application tables.'; exit 1; }
psql -XqAt -v ON_ERROR_STOP=1 -f scripts/restore-drill-checks.sql | awk '/^rows\|/' | sort > restored-counts.txt
sort backup/row-counts.txt > expected-counts.txt
cmp --silent restored-counts.txt expected-counts.txt
echo "Application data restored and row counts matched in $((SECONDS-started)) seconds." >> "$GITHUB_STEP_SUMMARY"
