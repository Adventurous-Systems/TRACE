-- Restore the curated demo catalogue to a presentable, verifiable state.
--
-- Context (production, verified 2026-09-01):
--   * 5 of 7 curated listings were stuck `reserved` from June's workshop offers,
--     so the marketplace showed only 3 listings — one of them junk ("Test - Door").
--   * All 7 curated listings had expires_at = 2026-09-02, after which the
--     "make an offer" demo step throws `Listing has expired`.
--   * `status` is part of the canonical document hashed by
--     packages/api/src/lib/passport-hash.ts, and makeOffer flips a passport to
--     `reserved` WITHOUT re-hashing — so verify-integrity returned match:false
--     on the demo's headline product (K-BRIQ®). Setting status back to the value
--     that was hashed at seed time ('listed') restores match:true with no rehash.
--
-- Safe to re-run: every statement is idempotent (converges to the same state).
-- Run inside one transaction; expected row counts are asserted before COMMIT.
--
-- Usage:
--   docker compose exec -T postgres psql -U trace -d trace -v ON_ERROR_STOP=1 \
--     < ops/sql/2026-09-01-restore-curated-demo-state.sql
--
-- Take a backup first:
--   ./ops/backup_db.sh /opt/TRACE

\set SEED_TAG '\'workshop-curated-2026-06\''

BEGIN;

-- 1. Cancel leftover in-progress transactions on curated listings.
--    NOTE: this clears real June attendees' "order in progress" state.
UPDATE transactions t SET status = 'cancelled'
  FROM listings l
 WHERE t.listing_id = l.id
   AND t.status IN ('pending', 'confirmed')
   AND l.passport_id IN (
        SELECT id FROM material_passports
         WHERE custom_attributes->>'seedSource' = :SEED_TAG);

-- 2. Reactivate curated listings and remove the 90-day expiry entirely.
--    Demo listings should never expire; seed-products.ts is fixed to match.
UPDATE listings l SET status = 'active', expires_at = NULL
  FROM material_passports p
 WHERE l.passport_id = p.id
   AND p.custom_attributes->>'seedSource' = :SEED_TAG;

-- 3. Restore the passport status that was hashed at seed time.
--    updated_at is NOT part of the canonical document, so touching it is safe.
UPDATE material_passports SET status = 'listed', updated_at = now()
 WHERE custom_attributes->>'seedSource' = :SEED_TAG;

-- 4. Hide non-curated listings so the marketplace shows only the demo catalogue.
--    Passports, users and organisations are deliberately NOT touched — the
--    supplier accounts are real workshop attendees and sales leads.
UPDATE listings l SET status = 'cancelled'
  FROM material_passports p
 WHERE l.passport_id = p.id
   AND l.status = 'active'
   AND coalesce(p.custom_attributes->>'seedSource', '') <> :SEED_TAG;

-- Assertions — roll back rather than commit a surprising result.
DO $$
DECLARE
  active_curated int;
  stray_active   int;
BEGIN
  SELECT count(*) INTO active_curated
    FROM listings l JOIN material_passports p ON l.passport_id = p.id
   WHERE p.custom_attributes->>'seedSource' = 'workshop-curated-2026-06'
     AND l.status = 'active' AND l.expires_at IS NULL;

  SELECT count(*) INTO stray_active
    FROM listings l JOIN material_passports p ON l.passport_id = p.id
   WHERE coalesce(p.custom_attributes->>'seedSource', '') <> 'workshop-curated-2026-06'
     AND l.status = 'active';

  IF active_curated <> 7 THEN
    RAISE EXCEPTION 'Expected 7 active non-expiring curated listings, found %', active_curated;
  END IF;
  IF stray_active <> 0 THEN
    RAISE EXCEPTION 'Expected 0 stray active listings, found %', stray_active;
  END IF;

  RAISE NOTICE 'OK: 7 curated listings active and non-expiring, no stray listings.';
END $$;

COMMIT;
