/**
 * Restore the demo environment to a known-good, presentable state.
 *
 * WHY THIS EXISTS
 * Demos degrade. An offer flips a curated product to `reserved` and it vanishes
 * from the marketplace; a prospect leaves a test listing behind; a listing
 * expires; someone edits a price. Before this script the only options were
 * `reset:marketplace` (truncates everything, including the curated catalogue
 * and any real user's data) or `seed:products` (all-or-nothing: it no-ops if
 * ANY curated passport exists, so it cannot repair a partial set, and a
 * --unseed/re-seed round trip mints new UUIDs and invalidates printed QR codes).
 *
 * This fills the gap between them: convergent, tag-scoped, and UUID-preserving.
 * Run it before a demo, or after one.
 *
 * WHAT IT CONVERGES (anything tagged customAttributes.seedSource = SEED_TAG)
 *   - passport fields back to the catalogue values (a fiddled price or grade
 *     is undone);
 *   - passport fingerprints recomputed, so verify-integrity passes;
 *   - exactly one active, never-expiring listing per curated passport;
 *   - curated in-flight transactions cleared.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH
 *   - it NEVER deletes a user or an organisation, and never modifies an account
 *     that is not in DEMO_PERSONAS. The supplier accounts on the demo box are
 *     real workshop attendees and sales leads (councils, universities, Zero
 *     Waste Scotland). Removing a lead is a reviewed, exported one-off, never a
 *     scripted side effect. It DOES converge the platform-owned demo personas
 *     (creating them if absent, correcting a drifted role or password), because
 *     the demo and its readiness check both depend on those existing.
 *   - non-curated passports. Visitors' own passports stay; only their
 *     *listings* are swept (with --sweep), which is enough to keep the
 *     marketplace presentable.
 *   - anchored passports (blockchain_tx_hash set): rehashing one would
 *     de-sync it from the chain. It reports them instead.
 *
 * LIMITATION: it converges curated passports that EXIST. It does not re-create
 * a curated passport that has been deleted outright, because that needs the
 * MinIO photo upload path in seed-products.ts. It detects and reports that
 * case with the exact command to fix it.
 *
 * Usage:
 *   pnpm --filter @trace/db demo:verify  -- --env demo-production
 *   pnpm --filter @trace/db demo:restore -- --env demo-production --dry-run
 *   pnpm --filter @trace/db demo:restore -- --env demo-production --yes [--sweep]
 *
 * --sweep additionally cancels non-curated listings older than
 * DEMO_LISTING_TTL_HOURS (default 24), so a prospect's own listing survives
 * their session but is gone before the next demo.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, inArray, lt, ne, notInArray, sql as dsql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { DEMO_PERSONA_LIST, HUB_ORG_SLUG } from '@trace/core/constants/demo-personas';
import * as schema from '../drizzle/schema.js';
import { computePassportHash } from '../src/passport-hash.js';
import { resolveTarget } from './lib/guard.js';
import { CATALOG, SEED_TAG } from './lib/catalogue.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(SCRIPT_DIR, '../../../.env') });

const LISTING_TTL_HOURS = Number(process.env['DEMO_LISTING_TTL_HOURS'] ?? 24);
const HOUR = 60 * 60 * 1000;

interface Problem {
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Fields the catalogue derives from `Date.now()` at import time, so their value
 * differs on every run. Converging them would rewrite the row (and therefore
 * the fingerprint) every single time, and demo:verify could never report a
 * clean environment. They are seeded once and then left alone.
 */
const RELATIVE_DATE_FIELDS = new Set(['deconstructionDate', 'productionDate']);

/**
 * Postgres JSONB does not preserve key insertion order, so a round-tripped
 * object compares unequal under JSON.stringify even when nothing changed.
 * Sort keys recursively before comparing.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const verifyOnly = argv.includes('--verify');
  const dryRun = argv.includes('--dry-run') || verifyOnly;
  const confirmed = argv.includes('--yes');
  const sweep = argv.includes('--sweep');

  const target = resolveTarget(argv);

  if (!dryRun && !confirmed) {
    console.error('\nRefusing to write without --yes. Re-run with --dry-run to preview.');
    process.exit(1);
  }

  const mode = verifyOnly
    ? 'VERIFY (read-only)'
    : dryRun
      ? 'DRY-RUN (no writes)'
      : 'LIVE (writes enabled)';
  console.log(`\nDemo ${verifyOnly ? 'verify' : 'restore'} — ${mode}\n  target: ${target.description}\n`);

  const client = postgres(target.databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });
  const curatedFilter = dsql`${schema.materialPassports.customAttributes}->>'seedSource' = ${SEED_TAG}`;
  const problems: Problem[] = [];

  try {
    // ── 0. Demo personas: create if absent, correct if drifted ───────────────
    // Scoped strictly to DEMO_PERSONAS. Any other account is left untouched.
    console.log('Demo personas:');
    const hubOrg = await db.query.organisations.findFirst({
      where: eq(schema.organisations.slug, HUB_ORG_SLUG),
    });
    if (!hubOrg) {
      problems.push({
        severity: 'error',
        message:
          `the seeded hub organisation ("${HUB_ORG_SLUG}") is missing — run ` +
          '`pnpm --filter @trace/db seed` first',
      });
    }

    for (const persona of DEMO_PERSONA_LIST) {
      const existing = await db.query.users.findFirst({
        where: eq(schema.users.email, persona.email),
      });

      // Resolve the organisation this persona should belong to.
      let organisationId: string | null = null;
      if (persona.organisation === 'hub') {
        organisationId = hubOrg?.id ?? null;
      } else if (persona.organisation === 'own') {
        const slug = `demo-${persona.key.toLowerCase()}`;
        let own = await db.query.organisations.findFirst({
          where: eq(schema.organisations.slug, slug),
        });
        if (!own && existing?.organisationId) {
          // Persona already has an organisation (e.g. created by seed:workshop) — keep it.
          organisationId = existing.organisationId;
        } else if (!own) {
          if (!dryRun) {
            const [created] = await db
              .insert(schema.organisations)
              .values({
                name: `${persona.name} (Demo)`,
                type: 'contractor',
                slug,
                verified: true,
              })
              .returning();
            own = created;
          }
          organisationId = own?.id ?? null;
        } else {
          organisationId = own.id;
        }
      }

      if (!existing) {
        if (!dryRun) {
          await db.insert(schema.users).values({
            email: persona.email,
            passwordHash: await bcrypt.hash(persona.password, 10),
            name: persona.name,
            role: persona.role,
            organisationId,
          });
        }
        console.log(`  ${dryRun ? 'would create' : 'created    '} ${persona.email} (${persona.role})`);
        continue;
      }

      // Converge rather than skip, so a drifted role is corrected. (Staging had
      // buyer@example.com sitting as hub_staff, which would fail buyer tests.)
      const roleDrifted = existing.role !== persona.role;
      const orgDrifted = organisationId !== null && existing.organisationId !== organisationId;
      const passwordOk = await bcrypt.compare(persona.password, existing.passwordHash);

      if (!roleDrifted && !orgDrifted && passwordOk) {
        console.log(`  ok          ${persona.email}`);
        continue;
      }

      const fixes = [
        roleDrifted ? `role ${existing.role}->${persona.role}` : null,
        orgDrifted ? 'organisation' : null,
        passwordOk ? null : 'password',
      ].filter(Boolean);

      if (!dryRun) {
        await db
          .update(schema.users)
          .set({
            role: persona.role,
            ...(organisationId !== null ? { organisationId } : {}),
            ...(passwordOk ? {} : { passwordHash: await bcrypt.hash(persona.password, 10) }),
          })
          .where(eq(schema.users.id, existing.id));
      }
      console.log(
        `  ${dryRun ? 'would fix   ' : 'fixed       '}${persona.email}  [${fixes.join(', ')}]`,
      );
    }
    console.log('');

    // ── 1. Curated passports: converge to the catalogue, then rehash ─────────
    const curated = await db.select().from(schema.materialPassports).where(curatedFilter);
    const byName = new Map(curated.map((p) => [p.productName, p]));

    console.log(`Curated catalogue (${curated.length}/${CATALOG.length} present):`);

    const missing = CATALOG.filter((c) => !byName.has(c.passport.productName!));
    for (const m of missing) {
      problems.push({
        severity: 'error',
        message:
          `curated passport missing: "${m.passport.productName}" — this script cannot ` +
          're-create it (needs the MinIO photo upload). Fix with:\n' +
          '       pnpm --filter @trace/db seed:products -- --unseed --yes && ' +
          'pnpm --filter @trace/db seed:products\n' +
          '       (note: that re-mints UUIDs, invalidating any printed QR codes)',
      });
    }

    for (const product of CATALOG) {
      const existing = byName.get(product.passport.productName!);
      if (!existing) continue;

      // Converge the catalogue-owned fields. status is set to 'listed' because
      // that is what an actively-listed curated product should be; it is no
      // longer part of the fingerprint, so this cannot break verify-integrity.
      const desired = {
        ...product.passport,
        status: 'listed' as const,
        customAttributes: { seedSource: SEED_TAG },
      };

      const drifted = (Object.keys(desired) as (keyof typeof desired)[]).filter((key) => {
        if (RELATIVE_DATE_FIELDS.has(key as string)) return false;
        const want = desired[key];
        const have = (existing as Record<string, unknown>)[key as string];
        if (want instanceof Date && have instanceof Date) return want.getTime() !== have.getTime();
        return stableStringify(want) !== stableStringify(have);
      });

      // Never write a relative date back — see RELATIVE_DATE_FIELDS.
      for (const field of RELATIVE_DATE_FIELDS) {
        delete (desired as Record<string, unknown>)[field];
      }

      if (drifted.length > 0 && !dryRun) {
        await db
          .update(schema.materialPassports)
          .set({ ...desired, updatedAt: new Date() })
          .where(eq(schema.materialPassports.id, existing.id));
      }

      // Recompute the fingerprint from the PERSISTED row, never from an
      // in-memory merge of catalogue values. The canonical document is built
      // with JSON.stringify, and Postgres JSONB normalises key order — so a
      // catalogue-authored object and its stored form serialise differently
      // and hash differently, even though they are the same data. Hashing the
      // merge produced fingerprints that failed the very check this script
      // makes. Never touch a passport that is anchored on chain.
      const fresh =
        drifted.length > 0 && !dryRun
          ? (await db.query.materialPassports.findFirst({
              where: eq(schema.materialPassports.id, existing.id),
            }))!
          : existing;

      const wantHash = computePassportHash(fresh as typeof existing);
      const hashDrifted = fresh.blockchainPassportHash !== wantHash;

      if (hashDrifted && fresh.blockchainTxHash) {
        problems.push({
          severity: 'warning',
          message:
            `"${product.passport.productName}" is anchored on chain (${fresh.blockchainTxHash}) ` +
            'but its fingerprint no longer matches — needs a re-anchor, not a rehash. Skipped.',
        });
      } else if (hashDrifted && !dryRun) {
        await db
          .update(schema.materialPassports)
          .set({
            blockchainPassportHash: wantHash,
            blockchainAnchoredAt: fresh.blockchainAnchoredAt ?? new Date(),
            blockchainTxHash: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.materialPassports.id, existing.id));
      } else if (hashDrifted && dryRun) {
        problems.push({
          severity: 'error',
          message: `"${product.passport.productName}" fingerprint mismatch — verify-integrity would fail`,
        });
      }

      const changes = [
        drifted.length > 0 ? `${drifted.length} field(s): ${drifted.join(', ')}` : null,
        hashDrifted ? 'fingerprint' : null,
      ].filter(Boolean);

      console.log(
        `  ${changes.length ? (dryRun ? 'would fix' : 'fixed   ') : 'ok      '} ${product.passport.productName}` +
          (changes.length ? `  [${changes.join('; ')}]` : ''),
      );
    }

    const curatedIds = curated.map((p) => p.id);

    // ── 2. Curated listings: exactly one, active, never expiring ─────────────
    if (curatedIds.length > 0) {
      const listings = await db
        .select()
        .from(schema.listings)
        .where(inArray(schema.listings.passportId, curatedIds));

      const byPassport = new Map<string, typeof listings>();
      for (const l of listings) {
        byPassport.set(l.passportId, [...(byPassport.get(l.passportId) ?? []), l]);
      }

      let listingFixes = 0;
      let duplicatesCancelled = 0;

      for (const product of CATALOG) {
        const passport = byName.get(product.passport.productName!);
        if (!passport) continue;
        const own = (byPassport.get(passport.id) ?? []).sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );

        if (own.length === 0) {
          problems.push({
            severity: 'error',
            message: `"${product.passport.productName}" has no listing — it will not appear on the marketplace`,
          });
          continue;
        }

        const [keep, ...extras] = own;
        const needsFix =
          keep!.status !== 'active' ||
          keep!.expiresAt !== null ||
          keep!.pricePence !== product.listing.pricePence ||
          keep!.quantity !== product.listing.quantity;

        if (needsFix) {
          listingFixes += 1;
          if (!dryRun) {
            await db
              .update(schema.listings)
              .set({
                status: 'active',
                expiresAt: null,
                pricePence: product.listing.pricePence,
                quantity: product.listing.quantity,
              })
              .where(eq(schema.listings.id, keep!.id));
          }
        }

        for (const extra of extras) {
          if (extra.status === 'cancelled') continue;
          duplicatesCancelled += 1;
          if (!dryRun) {
            await db
              .update(schema.listings)
              .set({ status: 'cancelled' })
              .where(eq(schema.listings.id, extra.id));
          }
        }
      }

      console.log(
        `\nCurated listings: ${dryRun ? 'would fix' : 'fixed'} ${listingFixes}` +
          `, ${dryRun ? 'would cancel' : 'cancelled'} ${duplicatesCancelled} duplicate(s)`,
      );

      // ── 3. Clear curated in-flight transactions ───────────────────────────
      const curatedListingIds = listings.map((l) => l.id);
      if (curatedListingIds.length > 0) {
        const stale = await db
          .select({ id: schema.transactions.id })
          .from(schema.transactions)
          .where(
            and(
              inArray(schema.transactions.listingId, curatedListingIds),
              inArray(schema.transactions.status, ['pending', 'confirmed']),
            ),
          );
        if (stale.length > 0 && !dryRun) {
          await db
            .update(schema.transactions)
            .set({ status: 'cancelled' })
            .where(inArray(schema.transactions.id, stale.map((s) => s.id)));
        }
        console.log(
          `Curated transactions: ${dryRun ? 'would clear' : 'cleared'} ${stale.length} in-flight`,
        );
      }
    }

    // ── 4. Sweep visitor-created listings (opt-in) ───────────────────────────
    if (sweep) {
      const cutoff = new Date(Date.now() - LISTING_TTL_HOURS * HOUR);
      const strays = await db
        .select({ id: schema.listings.id, name: schema.materialPassports.productName })
        .from(schema.listings)
        .innerJoin(
          schema.materialPassports,
          eq(schema.listings.passportId, schema.materialPassports.id),
        )
        .where(
          and(
            eq(schema.listings.status, 'active'),
            lt(schema.listings.createdAt, cutoff),
            curatedIds.length > 0
              ? notInArray(schema.listings.passportId, curatedIds)
              : ne(schema.listings.id, ''),
          ),
        );

      if (strays.length > 0 && !dryRun) {
        await db
          .update(schema.listings)
          .set({ status: 'cancelled' })
          .where(inArray(schema.listings.id, strays.map((s) => s.id)));
      }
      console.log(
        `\nSweep: ${dryRun ? 'would cancel' : 'cancelled'} ${strays.length} visitor listing(s) ` +
          `older than ${LISTING_TTL_HOURS}h (passports and accounts untouched)`,
      );
      for (const s of strays) console.log(`  - ${s.name}`);
    }

    // ── 5. Invariants ────────────────────────────────────────────────────────
    const finalListings = await db
      .select({ id: schema.listings.id })
      .from(schema.listings)
      .innerJoin(
        schema.materialPassports,
        eq(schema.listings.passportId, schema.materialPassports.id),
      )
      .where(and(eq(schema.listings.status, 'active'), curatedFilter));

    const finalCurated = await db.select().from(schema.materialPassports).where(curatedFilter);
    const badHashes = finalCurated.filter(
      (p) => p.blockchainPassportHash !== computePassportHash(p),
    );

    // These run in EVERY mode, including --verify. They were previously behind
    // an `if (!dryRun)` guard, which meant demo:verify printed "6/7 listings"
    // and still exited 0 — a readiness check that reports success while the
    // demo is broken is worse than no check at all. Caught by making a real
    // offer on staging and watching verify pass anyway.
    if (finalListings.length !== CATALOG.length) {
      problems.push({
        severity: 'error',
        message:
          `expected ${CATALOG.length} active curated listings, found ${finalListings.length}` +
          (dryRun ? ' — run demo:restore to fix' : ''),
      });
    }
    if (!dryRun) {
      for (const p of badHashes) {
        problems.push({
          severity: 'error',
          message: `"${p.productName}" fingerprint still mismatched after restore`,
        });
      }
    }

    // Demo mode lives only in the deployment's .env, which is not
    // version-controlled. If it is off without contracts deployed, every
    // passport created during a demo stays on "Pending verification" forever
    // and the trust moment simply never happens — so check it here rather than
    // discovering it live.
    const simulateAnchor = process.env['DEMO_SIMULATE_ANCHOR'] === 'true';
    const registryAddress = process.env['MATERIAL_REGISTRY_ADDRESS'];
    if (!simulateAnchor && !registryAddress) {
      problems.push({
        severity: 'error',
        message:
          'DEMO_SIMULATE_ANCHOR is not true and no MATERIAL_REGISTRY_ADDRESS is set — ' +
          'passports created during a demo will never show the trust seal.\n' +
          "       Set DEMO_SIMULATE_ANCHOR=true in this deployment's .env.",
      });
    }

    console.log('\n─────────────────────────────────────────────');
    console.log(`Anchor mode             : ${simulateAnchor ? 'simulated' : registryAddress ? 'on-chain' : 'NONE'}`);
    console.log(`Active curated listings : ${finalListings.length}/${CATALOG.length}`);
    console.log(`Fingerprints matching   : ${finalCurated.length - badHashes.length}/${finalCurated.length}`);

    const errors = problems.filter((p) => p.severity === 'error');
    const warnings = problems.filter((p) => p.severity === 'warning');

    for (const w of warnings) console.log(`\nWARNING: ${w.message}`);
    for (const e of errors) console.log(`\nPROBLEM: ${e.message}`);

    if (errors.length > 0) {
      console.log(`\n${errors.length} problem(s) — demo is NOT ready.\n`);
      process.exitCode = 1;
    } else {
      console.log(`\nDemo is ready.${warnings.length ? ` (${warnings.length} warning(s))` : ''}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
