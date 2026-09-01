/**
 * The demo persona set — one definition, used by everything.
 *
 * WHY THIS EXISTS
 * The accounts a demo depends on were previously defined in four places that
 * disagreed with each other:
 *
 *   - packages/db/scripts/seed.ts            (the five system accounts)
 *   - packages/db/scripts/seed-workshop.ts   (+ an example attendee CSV)
 *   - packages/db/scripts/sync-users.ts      (which DELETED some of the above)
 *   - packages/e2e/fixtures/accounts.ts      (which required the deleted ones)
 *
 * The result: `ada.lovelace@example.com` had three different documented
 * passwords (TraceWorkshop2026! / TRACE_SRH! / Password1234!), and
 * `grace.hopper@example.com` — required by the e2e suite before any test runs —
 * was deleted from both deployed environments by sync:users. That is why the
 * production smoke workflow has been failing: not because the platform was
 * broken, but because the check could not log in.
 *
 * These personas are PLATFORM-OWNED demo identities. They are safe to create,
 * converge and re-password automatically. They are deliberately distinct from
 * the real supplier accounts on the demo box, which belong to workshop
 * attendees and sales leads (councils, universities, Zero Waste Scotland) and
 * must never be modified or deleted by any script.
 *
 * `demo:restore` converges this set. `packages/e2e/fixtures/accounts.ts` reads
 * from it, so the readiness check and the demo can never again disagree about
 * who exists.
 */

export type DemoPersonaKey =
  | 'platformAdmin'
  | 'hubAdmin'
  | 'hubStaff'
  | 'inspector'
  | 'buyer'
  | 'supplier'
  | 'supplier2';

export interface DemoPersona {
  key: DemoPersonaKey;
  email: string;
  password: string;
  name: string;
  /** Matches the application's UserRole values. */
  role: 'platform_admin' | 'hub_admin' | 'hub_staff' | 'inspector' | 'buyer' | 'supplier';
  /**
   * How this persona is attached to an organisation:
   *   'hub'  — the seeded reuse hub (hub_admin / hub_staff need this)
   *   'own'  — its own organisation, created if absent (suppliers list stock)
   *   'none' — no organisation
   */
  organisation: 'hub' | 'own' | 'none';
  /** Shown in the demo run sheet so the presenter knows what each is for. */
  purpose: string;
}

/** Slug of the organisation created by `seed`, used for the 'hub' attachment. */
export const HUB_ORG_SLUG = 'stirling';

export const DEMO_PERSONAS: Record<DemoPersonaKey, DemoPersona> = {
  platformAdmin: {
    key: 'platformAdmin',
    email: 'platform@trace.eco',
    password: 'Platform1234!',
    name: 'Platform Admin',
    role: 'platform_admin',
    organisation: 'none',
    purpose: 'Governance walkthrough: access requests and the feedback inbox',
  },
  hubAdmin: {
    key: 'hubAdmin',
    email: 'admin@stirlingreuse.com',
    password: 'Admin1234!',
    name: 'Hub Admin',
    role: 'hub_admin',
    organisation: 'hub',
    purpose: 'Owns the curated catalogue; the seller behind every demo listing',
  },
  hubStaff: {
    key: 'hubStaff',
    email: 'staff@stirlingreuse.com',
    password: 'Staff1234!',
    name: 'Hub Staff',
    role: 'hub_staff',
    organisation: 'hub',
    purpose: 'Registers materials and issues passports',
  },
  inspector: {
    key: 'inspector',
    email: 'inspector@trace.eco',
    password: 'Inspector1234!',
    name: 'Quality Inspector',
    role: 'inspector',
    organisation: 'none',
    purpose: 'Quality report workflow',
  },
  buyer: {
    key: 'buyer',
    email: 'buyer@example.com',
    password: 'Buyer1234!',
    name: 'Demo Buyer',
    role: 'buyer',
    organisation: 'none',
    purpose: 'Makes an offer on a listing',
  },
  supplier: {
    key: 'supplier',
    email: 'ada.lovelace@example.com',
    password: 'TraceWorkshop2026!',
    name: 'Ada Lovelace',
    role: 'supplier',
    organisation: 'own',
    purpose: 'Presenter account: registers a material live during the demo',
  },
  supplier2: {
    // Replaces grace.hopper@example.com, which sync:users deleted from both
    // deployed environments while the e2e suite still required it. A
    // platform-owned address cannot be mistaken for a real lead and is
    // guaranteed by demo:restore.
    key: 'supplier2',
    email: 'demo.supplier2@trace.eco',
    password: 'TraceWorkshop2026!',
    name: 'Demo Supplier Two',
    role: 'supplier',
    organisation: 'own',
    purpose: 'Second party, so buyer/seller interactions can be shown end to end',
  },
};

export const DEMO_PERSONA_LIST: DemoPersona[] = Object.values(DEMO_PERSONAS);

/** Emails owned by the demo system — safe for scripts to converge. */
export const DEMO_PERSONA_EMAILS: string[] = DEMO_PERSONA_LIST.map((p) => p.email);
