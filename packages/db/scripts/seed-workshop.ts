/**
 * Workshop attendee seeder.
 *
 * Seeds attendee accounts for the TRACE Workshop Showcase (8 June 2026).
 * Each attendee becomes a `supplier` (the seller persona) in their OWN
 * single-person organisation, so the existing organisation-scoped ownership
 * checks keep every attendee isolated to their own passports and listings.
 *
 * Safety properties:
 *   - never overwrites an existing user (skips + logs)
 *   - validates email format (invalid rows are reported as failed, not created)
 *   - only ever assigns the `supplier` role — never admin
 *   - supports a --dry-run mode that performs no writes
 *   - prints a created / skipped / failed summary
 *   - each attendee is created in a single transaction (org + user together)
 *
 * Usage:
 *   pnpm --filter @trace/db seed:workshop -- --file ./data/workshop-attendees.csv [--dry-run] [--password '...']
 *
 * Input file (CSV, default ./data/workshop-attendees.csv relative to packages/db):
 *   email,name
 *   ada.lovelace@example.com,Ada Lovelace
 *   grace@example.com
 *   # lines starting with '#' and blank lines are ignored; name is optional
 *
 * A JSON file is also accepted: an array of "email" strings or { email, name } objects.
 *
 * The generic password comes from --password, else $WORKSHOP_PASSWORD, else a
 * documented default. Share it with attendees; rotate/disable accounts after the event.
 */
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'fs';
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

const DEFAULT_PASSWORD = 'TraceWorkshop2026!';
const DEFAULT_FILE = path.resolve(PACKAGE_ROOT, 'data/workshop-attendees.csv');
// Pragmatic email check — good enough to reject typos, not a full RFC 5322 parser.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Attendee {
  email: string;
  name?: string;
}

interface CliOptions {
  file: string;
  dryRun: boolean;
  password: string;
}

function parseArgs(argv: string[]): CliOptions {
  let file = DEFAULT_FILE;
  let dryRun = false;
  let password = process.env['WORKSHOP_PASSWORD'] ?? DEFAULT_PASSWORD;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--file' || arg === '-f') {
      const value = argv[++i];
      if (!value) throw new Error('--file requires a path');
      file = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
    } else if (arg === '--password' || arg === '-p') {
      const value = argv[++i];
      if (!value) throw new Error('--password requires a value');
      password = value;
    } else if (arg === '--') {
      // pnpm forwards a literal `--` separator before script args; ignore it.
      continue;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: seed:workshop -- --file <path> [--dry-run] [--password <pw>]');
      process.exit(0);
    } else if (arg) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { file, dryRun, password };
}

function parseAttendees(filePath: string): Attendee[] {
  const raw = readFileSync(filePath, 'utf-8');

  if (filePath.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) throw new Error('JSON attendee file must be an array');
    return data.map((entry): Attendee => {
      if (typeof entry === 'string') return { email: entry.trim() };
      const obj = entry as { email?: unknown; name?: unknown };
      const email = String(obj.email ?? '').trim();
      const name = typeof obj.name === 'string' ? obj.name.trim() : '';
      return name ? { email, name } : { email };
    });
  }

  // CSV: one attendee per line, "email[,name]". '#' comments and blanks ignored.
  const attendees: Attendee[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [emailCol, ...nameCols] = trimmed.split(',');
    const email = (emailCol ?? '').trim();
    // Skip a header row if present.
    if (email.toLowerCase() === 'email') continue;
    const name = nameCols.join(',').trim();
    attendees.push(name ? { email, name } : { email });
  }
  return attendees;
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || email;
}

function slugFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? 'seller')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seller';
  return `${local}-${randomBytes(3).toString('hex')}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL environment variable is required');

  const attendees = parseAttendees(opts.file);
  console.log(`\nWorkshop seeder — ${attendees.length} attendee row(s) from ${opts.file}`);
  console.log(opts.dryRun ? '  MODE: dry-run (no writes)\n' : '  MODE: live (writes enabled)\n');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const passwordHash = opts.dryRun ? '' : await bcrypt.hash(opts.password, 10);

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ email: string; reason: string }> = [];

  for (const attendee of attendees) {
    const email = attendee.email.trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      failed.push({ email: attendee.email || '(blank)', reason: 'invalid email' });
      console.log(`  ✗ failed:  ${attendee.email || '(blank)'} — invalid email`);
      continue;
    }

    try {
      const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (existing) {
        skipped.push(email);
        console.log(`  – skipped: ${email} (already exists)`);
        continue;
      }

      const name = attendee.name?.trim() || nameFromEmail(email);

      if (opts.dryRun) {
        created.push(email);
        console.log(`  ✓ would create: ${email} (supplier) → org "${name} (Workshop)"`);
        continue;
      }

      await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(schema.organisations)
          .values({
            name: `${name} (Workshop)`,
            type: 'contractor',
            slug: slugFromEmail(email),
            verified: true,
          })
          .returning();

        await tx.insert(schema.users).values({
          email,
          passwordHash,
          name,
          role: 'supplier',
          organisationId: org!.id,
        });
      });

      created.push(email);
      console.log(`  ✓ created: ${email} (supplier)`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ email, reason });
      console.log(`  ✗ failed:  ${email} — ${reason}`);
    }
  }

  await client.end();

  console.log('\n─────────────────────────────────────');
  console.log('Summary');
  console.log(`  created: ${created.length}`);
  console.log(`  skipped: ${skipped.length}`);
  console.log(`  failed:  ${failed.length}`);
  if (failed.length) {
    console.log('\nFailed rows:');
    for (const f of failed) console.log(`  - ${f.email}: ${f.reason}`);
  }
  if (!opts.dryRun && created.length) {
    console.log(`\nGeneric workshop password: ${opts.password}`);
    console.log('Share this with attendees. Rotate or disable these accounts after the showcase.');
  }
  if (opts.dryRun) {
    console.log('\nDry run complete — re-run without --dry-run to apply.');
  }
}

main().catch((err) => {
  console.error('Workshop seed failed:', err);
  process.exit(1);
});
