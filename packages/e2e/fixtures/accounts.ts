import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_PERSONAS } from '@trace/core/constants/demo-personas';

export type Role = 'supplier' | 'supplier2' | 'hubStaff' | 'buyer' | 'platformAdmin';

export interface Account {
  role: Role;
  email: string;
  password: string;
}

/**
 * Test accounts, derived from the single demo persona definition in
 * @trace/core so this file can no longer drift from what the demo environment
 * actually contains.
 *
 * These previously hard-coded `grace.hopper@example.com`, which sync:users had
 * deleted from both deployed environments — so global-setup failed to log in
 * before a single test ran, and the production smoke workflow reported the
 * platform as broken when it was healthy. Personas are now guaranteed by
 * `pnpm --filter @trace/db demo:restore`.
 */
export const ACCOUNTS: Record<Role, Account> = {
  supplier: {
    role: 'supplier',
    email: DEMO_PERSONAS.supplier.email,
    password: DEMO_PERSONAS.supplier.password,
  },
  supplier2: {
    role: 'supplier2',
    email: DEMO_PERSONAS.supplier2.email,
    password: DEMO_PERSONAS.supplier2.password,
  },
  hubStaff: {
    role: 'hubStaff',
    email: DEMO_PERSONAS.hubStaff.email,
    password: DEMO_PERSONAS.hubStaff.password,
  },
  buyer: {
    role: 'buyer',
    email: DEMO_PERSONAS.buyer.email,
    password: DEMO_PERSONAS.buyer.password,
  },
  platformAdmin: {
    role: 'platformAdmin',
    email: DEMO_PERSONAS.platformAdmin.email,
    password: DEMO_PERSONAS.platformAdmin.password,
  },
};

/** API origin used by global-setup to mint sessions (same origin as web on the deployed domain). */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = path.resolve(here, '..', '.auth');
export const statePath = (role: Role): string => path.join(STATE_DIR, `${role}.json`);
