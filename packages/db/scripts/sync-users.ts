/**
 * Production user sync for the TRACE Workshop (8 June 2026).
 *
 * Removes a fixed set of accounts and (re)creates a fixed set of `supplier`
 * accounts — each supplier in its own single-person organisation, matching the
 * pattern used by seed-workshop.ts so org-scoped ownership checks isolate them.
 *
 * REMOVALS run before ADDITIONS, so an email present in both lists (e.g.
 * hicomcd@gmail.com — demoted from hub_admin to a fresh supplier) is recreated
 * cleanly with the new password.
 *
 * Before deleting a user, all FK references are cleared:
 *   - beta_access_requests.user_id rows deleted (column is NOT NULL)
 *   - beta_access_requests.reviewed_by / audit_events.actor_id /
 *     blockchain_transactions.actor_id / feedback_submissions.user_id /
 *     material_passports.registered_by  →  set NULL
 * The user's organisation is deleted only if it is left with no other users and
 * no passports/listings.
 *
 * Usage:
 *   pnpm --filter @trace/db sync:users -- [--dry-run] [--yes] [--password '...']
 *
 * Safety: --dry-run previews and writes nothing; a live run needs --yes.
 */
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import * as schema from '../drizzle/schema.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
loadEnv({ path: path.resolve(PACKAGE_ROOT, '../../.env') });

const DEFAULT_PASSWORD = 'TRACE_SRH!';

const REMOVE: string[] = [
  'hicomcd@gmail.com',
  'grace.hopper@example.com',
  'katherine.johnson@example.com',
  'newbuyer@test.com',
];

// email → optional display name (else derived from the local part).
const ADD: Array<{ email: string; name?: string }> = [
  { email: 'm.victoria@rgu.ac.uk' },
  { email: 't.dounas@hw.ac.uk' },
  { email: 'zj20@hw.ac.uk' },
  { email: 'm.blazusiak@rgu.ac.uk' },
  { email: 'hicomcd@gmail.com', name: 'Hico' },
];

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || email
  );
}

function slugFromEmail(email: string): string {
  const local =
    (email.split('@')[0] ?? 'seller').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
    'seller';
  return `${local}-${randomBytes(3).toString('hex')}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const confirmed = argv.includes('--yes');
  const pwIdx = argv.indexOf('--password');
  const password = pwIdx >= 0 ? argv[pwIdx + 1]! : process.env['WORKSHOP_PASSWORD'] ?? DEFAULT_PASSWORD;

  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL environment variable is required');
  if (!dryRun && !confirmed) {
    console.error('Refusing to modify users without --yes. Use --dry-run to preview.');
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });
  console.log(`\nUser sync — ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE (writes enabled)'}\n`);

  try {
    // ── Removals ──────────────────────────────────────────────────────────
    console.log('Removals:');
    for (const raw of REMOVE) {
      const email = raw.trim().toLowerCase();
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (!user) {
        console.log(`  – ${email} (not present, skipped)`);
        continue;
      }
      if (dryRun) {
        console.log(`  ✓ would remove ${email} (role ${user.role}, org ${user.organisationId ?? '-'})`);
        continue;
      }
      await db.transaction(async (tx) => {
        const uid = user.id;
        await tx.delete(schema.betaAccessRequests).where(eq(schema.betaAccessRequests.userId, uid));
        await tx
          .update(schema.betaAccessRequests)
          .set({ reviewedBy: null })
          .where(eq(schema.betaAccessRequests.reviewedBy, uid));
        await tx.update(schema.auditEvents).set({ actorId: null }).where(eq(schema.auditEvents.actorId, uid));
        await tx
          .update(schema.blockchainTransactions)
          .set({ actorId: null })
          .where(eq(schema.blockchainTransactions.actorId, uid));
        await tx
          .update(schema.feedbackSubmissions)
          .set({ userId: null })
          .where(eq(schema.feedbackSubmissions.userId, uid));
        await tx
          .update(schema.materialPassports)
          .set({ registeredBy: null })
          .where(eq(schema.materialPassports.registeredBy, uid));

        await tx.delete(schema.users).where(eq(schema.users.id, uid));
        // Their organisation is intentionally left in place — a userless org is
        // harmless, and deleting it would drag in audit_events / blockchain_txn
        // org references that we want to keep for history.
        console.log(`  ✓ removed ${email}`);
      });
    }

    // ── Additions ─────────────────────────────────────────────────────────
    const passwordHash = dryRun ? '' : await bcrypt.hash(password, 10);
    console.log('\nAdditions (role: supplier):');
    for (const entry of ADD) {
      const email = entry.email.trim().toLowerCase();
      const name = entry.name?.trim() || nameFromEmail(email);
      const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });

      // Already exists: converge to the desired end-state (supplier + own org +
      // the workshop password) instead of skipping, so a wrong-role account
      // (e.g. a leftover buyer) is corrected and the run is idempotent.
      if (existing) {
        if (dryRun) {
          const note =
            existing.role === 'supplier' && existing.organisationId
              ? 'already a supplier (password reset)'
              : `convert ${existing.role} → supplier`;
          console.log(`  ✓ would update ${email}: ${note}`);
          continue;
        }
        await db.transaction(async (tx) => {
          let orgId = existing.organisationId;
          if (!orgId) {
            const [org] = await tx
              .insert(schema.organisations)
              .values({ name: `${name} (Workshop)`, type: 'contractor', slug: slugFromEmail(email), verified: true })
              .returning();
            orgId = org!.id;
          }
          await tx
            .update(schema.users)
            .set({ role: 'supplier', organisationId: orgId, passwordHash })
            .where(eq(schema.users.id, existing.id));
        });
        console.log(`  ✓ updated ${email} → supplier (password reset)`);
        continue;
      }

      if (dryRun) {
        console.log(`  ✓ would create ${email} (supplier) → org "${name} (Workshop)"`);
        continue;
      }
      await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(schema.organisations)
          .values({ name: `${name} (Workshop)`, type: 'contractor', slug: slugFromEmail(email), verified: true })
          .returning();
        await tx
          .insert(schema.users)
          .values({ email, passwordHash, name, role: 'supplier', organisationId: org!.id });
      });
      console.log(`  ✓ created ${email} (supplier)`);
    }

    if (!dryRun) {
      console.log(`\nSupplier password for the new accounts: ${password}`);
      console.log('Rotate or disable these accounts after the showcase.');
    } else {
      console.log('\nDry run complete — re-run with --yes to apply.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('User sync failed:', err);
  process.exit(1);
});
