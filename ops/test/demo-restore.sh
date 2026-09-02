#!/usr/bin/env bash
# Adversarial test harness for demo:restore / demo:verify.
#
# Each case restores a pristine throwaway database from a backup dump, applies a
# deliberate act of sabotage, runs the script, and asserts the exit code and
# output. Nothing here touches a real environment: every case runs against
# $TEST_DB on the staging Postgres container.
#
# Usage:  ops/test/demo-restore.sh [name-filter]
set -uo pipefail

PGC="${PGC:-trace-staging-postgres-1}"
TEST_DB="${TEST_DB:-trace_demo_harness}"
DUMP="${DUMP:-$(ls -t /srv/backups/trace/trace-staging/*.dump 2>/dev/null | head -1)}"
REPO="${REPO:-/dev-github/TRACE}"
SCRIPT="$REPO/packages/db/scripts/demo-restore.ts"
FILTER="${1:-}"

PW=$(sudo grep -E '^DATABASE_URL=' /opt/TRACE-staging/.env | cut -d= -f2- | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
export TRACE_ENV=staging
export DEMO_SIMULATE_ANCHOR=true
export DATABASE_URL="postgresql://trace:${PW}@127.0.0.1:15433/${TEST_DB}"

PASS=0; FAIL=0; FAILED_NAMES=()

psql_t() { sudo docker exec "$PGC" psql -U trace -d "$TEST_DB" -tAc "$1"; }

reset_db() {
  sudo docker exec "$PGC" psql -U trace -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);" >/dev/null 2>&1
  sudo docker exec "$PGC" psql -U trace -d postgres -c "CREATE DATABASE ${TEST_DB};" >/dev/null 2>&1
  sudo docker exec -i "$PGC" pg_restore -U trace -d "$TEST_DB" --no-owner --no-privileges < "$DUMP" >/dev/null 2>&1
  # Bring the fixture to a known-good baseline first.
  npx tsx "$SCRIPT" --env staging --yes >/dev/null 2>&1
}

# run_case <name> <sabotage-sql|-> <args> <expected-exit> <expected-grep|-> [forbidden-grep]
run_case() {
  local name="$1" sql="$2" args="$3" want_exit="$4" want_grep="$5" forbid="${6:-}"
  [[ -n "$FILTER" && "$name" != *"$FILTER"* ]] && return 0

  reset_db
  [[ "$sql" != "-" ]] && psql_t "$sql" >/dev/null 2>&1

  local out rc
  out=$(npx tsx "$SCRIPT" $args 2>&1); rc=$?

  local ok=1 why=""
  [[ "$rc" != "$want_exit" ]] && { ok=0; why="exit $rc want $want_exit"; }
  if [[ "$want_grep" != "-" ]] && ! grep -qE -- "$want_grep" <<<"$out"; then
    ok=0; why="$why; missing /$want_grep/"
  fi
  if [[ -n "$forbid" ]] && grep -qE -- "$forbid" <<<"$out"; then
    ok=0; why="$why; found forbidden /$forbid/"
  fi

  if [[ $ok == 1 ]]; then
    printf '  PASS  %s\n' "$name"; PASS=$((PASS+1))
  else
    printf '  FAIL  %s  (%s)\n' "$name" "${why# ; }"; FAIL=$((FAIL+1)); FAILED_NAMES+=("$name")
    printf '%s\n' "$out" | tail -12 | sed 's/^/          | /'
  fi
}

echo "demo:restore harness — dump: $(basename "$DUMP")"
echo ""
TAG="workshop-curated-2026-06"
KB="product_name LIKE 'K-BRIQ%'"

echo "── guard ─────────────────────────────────────────────────────────────"
run_case "guard: refuses without --env"        - "--verify"                        1 "Refusing to run without --env"
run_case "guard: refuses mismatched --env"     - "--verify --env demo-production"  1 "WRONG TARGET"
run_case "guard: rejects unknown --env"        - "--verify --env prod"             1 "--env must be one of"
run_case "guard: refuses live write w/o --yes" - "--env staging"                   1 "Refusing to write without --yes"

echo ""
echo "── healthy baseline ──────────────────────────────────────────────────"
run_case "healthy: verify passes"              - "--verify --env staging"          0 "Demo is ready"
run_case "healthy: restore is a no-op"         - "--env staging --yes"             0 "Curated listings: fixed 0" "fixed [1-9]"

echo ""
echo "── listing damage ────────────────────────────────────────────────────"
run_case "listing reserved by an offer" \
  "UPDATE listings SET status='reserved' WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB);" \
  "--env staging --yes" 0 "Active curated listings : 7/7"
run_case "listing sold" \
  "UPDATE listings SET status='sold' WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB);" \
  "--env staging --yes" 0 "Active curated listings : 7/7"
run_case "listing cancelled" \
  "UPDATE listings SET status='cancelled' WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB);" \
  "--env staging --yes" 0 "Active curated listings : 7/7"
run_case "listing expired in the past" \
  "UPDATE listings SET expires_at=now()-interval '30 days' WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB);" \
  "--env staging --yes" 0 "Active curated listings : 7/7"
run_case "listing price tampered" \
  "UPDATE listings SET price_pence=999999 WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB);" \
  "--env staging --yes" 0 "Curated listings: fixed 1"
run_case "duplicate listing on one passport" \
  "INSERT INTO listings (passport_id, organisation_id, seller_id, price_pence, currency, quantity, status)
   SELECT passport_id, organisation_id, seller_id, price_pence, currency, quantity, 'active' FROM listings
   WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB) LIMIT 1;" \
  "--env staging --yes" 0 "cancelled 1 duplicate"
run_case "curated listing deleted entirely" \
  "DELETE FROM listings WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB);" \
  "--env staging --yes" 1 "has no listing"

echo ""
echo "── passport damage ───────────────────────────────────────────────────"
run_case "passport status tampered" \
  "UPDATE material_passports SET status='decommissioned' WHERE $KB;" \
  "--env staging --yes" 0 "Fingerprints matching   : 7/7"
run_case "passport grade tampered" \
  "UPDATE material_passports SET condition_grade='D' WHERE $KB;" \
  "--env staging --yes" 0 "conditionGrade"
run_case "fingerprint nulled" \
  "UPDATE material_passports SET blockchain_passport_hash=NULL WHERE $KB;" \
  "--env staging --yes" 0 "Fingerprints matching   : 7/7"
run_case "fingerprint garbage" \
  "UPDATE material_passports SET blockchain_passport_hash='0xdeadbeef' WHERE $KB;" \
  "--env staging --yes" 0 "Fingerprints matching   : 7/7"
run_case "curated passport deleted" \
  "DELETE FROM material_passports WHERE $KB;" \
  "--env staging --yes" 1 "curated passport missing"
run_case "anchored passport is NOT rehashed" \
  "UPDATE material_passports SET blockchain_tx_hash='0xabc123', blockchain_passport_hash='0xstale' WHERE $KB;" \
  "--env staging --yes" 1 "anchored on chain"
run_case "anchored passport keeps its stale hash" \
  "UPDATE material_passports SET blockchain_tx_hash='0xabc123', blockchain_passport_hash='0xstale' WHERE $KB;" \
  "--env staging --yes" 1 "re-anchor"

echo ""
echo "── persona damage ────────────────────────────────────────────────────"
run_case "persona deleted" \
  "DELETE FROM users WHERE email='demo.supplier2@trace.eco';" \
  "--env staging --yes" 0 "created.*demo.supplier2"
run_case "persona role drifted" \
  "UPDATE users SET role='buyer' WHERE email='ada.lovelace@example.com';" \
  "--env staging --yes" 0 "role buyer->supplier"
run_case "persona password changed" \
  "UPDATE users SET password_hash='\$2b\$10\$invalidhashinvalidhashinvalidhashinvalidhashinvalidha' WHERE email='buyer@example.com';" \
  "--env staging --yes" 0 "password"

echo ""
echo "── sweep semantics ───────────────────────────────────────────────────"
run_case "sweep: old visitor listing cancelled" \
  "INSERT INTO listings (passport_id, organisation_id, seller_id, price_pence, quantity, status, created_at)
   SELECT id, organisation_id, registered_by, 500, 1, 'active', now()-interval '48 hours'
   FROM material_passports WHERE coalesce(custom_attributes->>'seedSource','') <> '$TAG' AND registered_by IS NOT NULL LIMIT 1;" \
  "--env staging --yes --sweep" 0 "cancelled 1 visitor listing"
run_case "sweep: recent visitor listing survives" \
  "INSERT INTO listings (passport_id, organisation_id, seller_id, price_pence, quantity, status, created_at)
   SELECT id, organisation_id, registered_by, 500, 1, 'active', now()
   FROM material_passports WHERE coalesce(custom_attributes->>'seedSource','') <> '$TAG' AND registered_by IS NOT NULL LIMIT 1;" \
  "--env staging --yes --sweep" 0 "cancelled 0 visitor listing"
run_case "no sweep flag: visitor listing untouched" \
  "INSERT INTO listings (passport_id, organisation_id, seller_id, price_pence, quantity, status, created_at)
   SELECT id, organisation_id, registered_by, 500, 1, 'active', now()-interval '48 hours'
   FROM material_passports WHERE coalesce(custom_attributes->>'seedSource','') <> '$TAG' AND registered_by IS NOT NULL LIMIT 1;" \
  "--env staging --yes" 0 "Demo is ready" "Sweep:"

echo ""
echo "── verify must not lie ───────────────────────────────────────────────"
run_case "verify fails on missing listing" \
  "UPDATE listings SET status='reserved' WHERE passport_id IN (SELECT id FROM material_passports WHERE $KB);" \
  "--verify --env staging" 1 "expected 7 active curated listings, found 6"
run_case "verify fails on bad fingerprint" \
  "UPDATE material_passports SET blockchain_passport_hash='0xdead' WHERE $KB;" \
  "--verify --env staging" 1 "fingerprint mismatch"
run_case "verify fails on deleted persona" \
  "DELETE FROM users WHERE email='demo.supplier2@trace.eco';" \
  "--verify --env staging" 1 "would create"

echo ""
echo "── tag hygiene (found by probing) ────────────────────────────────────"
run_case "tagged passport not in catalogue is reported" \
  "INSERT INTO material_passports (organisation_id, product_name, category_l1, status, custom_attributes, registered_by)
   SELECT organisation_id, 'Sneaky Fake Product', category_l1, 'listed', '{\"seedSource\":\"$TAG\"}'::jsonb, registered_by
   FROM material_passports WHERE $KB LIMIT 1;" \
  "--verify --env staging" 1 "carries the curated tag but is not in the catalogue"
run_case "duplicate curated product name is reported" \
  "INSERT INTO material_passports (organisation_id, product_name, category_l1, status, custom_attributes, registered_by)
   SELECT organisation_id, product_name, category_l1, 'listed', custom_attributes, registered_by
   FROM material_passports WHERE $KB LIMIT 1;" \
  "--env staging --yes" 1 "share the name"
run_case "sweep with zero curated does not crash" \
  "DELETE FROM material_passports WHERE custom_attributes->>'seedSource'='$TAG';" \
  "--env staging --yes --sweep" 1 "curated passport missing" "invalid input syntax"

echo ""
echo "── anchor mode ───────────────────────────────────────────────────────"
DEMO_SIMULATE_ANCHOR=false run_case "anchor: no simulation, no contract = problem" \
  - "--verify --env staging" 1 "will never show the trust seal"

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
printf 'passed %d, failed %d\n' "$PASS" "$FAIL"
[[ $FAIL -gt 0 ]] && { printf 'failing: %s\n' "${FAILED_NAMES[*]}"; exit 1; }
sudo docker exec "$PGC" psql -U trace -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);" >/dev/null 2>&1
exit 0
