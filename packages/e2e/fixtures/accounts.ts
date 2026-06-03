import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Role = 'supplier' | 'supplier2' | 'hubStaff' | 'buyer' | 'platformAdmin';

export interface Account {
  role: Role;
  email: string;
  password: string;
}

/**
 * Seeded test accounts (created by `seed` + `seed:workshop`).
 * Supplier accounts use the generic workshop password.
 */
export const ACCOUNTS: Record<Role, Account> = {
  supplier: { role: 'supplier', email: 'ada.lovelace@example.com', password: 'TraceWorkshop2026!' },
  supplier2: { role: 'supplier2', email: 'grace.hopper@example.com', password: 'TraceWorkshop2026!' },
  hubStaff: { role: 'hubStaff', email: 'staff@stirlingreuse.com', password: 'Staff1234!' },
  buyer: { role: 'buyer', email: 'buyer@example.com', password: 'Buyer1234!' },
  platformAdmin: { role: 'platformAdmin', email: 'platform@trace.eco', password: 'Platform1234!' },
};

/** API origin used by global-setup to mint sessions (same origin as web on the deployed domain). */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = path.resolve(here, '..', '.auth');
export const statePath = (role: Role): string => path.join(STATE_DIR, `${role}.json`);
