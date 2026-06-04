import { request } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { ACCOUNTS, API_URL, STATE_DIR, statePath, type Account } from './fixtures/accounts';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Logs an account in via the API and writes a Playwright storageState file.
 * The web app authenticates from `localStorage` (trace_token / trace_user) plus
 * a `trace_auth` cookie used by the Next.js middleware — we set both.
 */
async function mintState(account: Account): Promise<void> {
  const ctx = await request.newContext({ baseURL: API_URL });

  // Retry: the API may be mid-restart right after a deploy (smoke runs eagerly).
  let lastError = '';
  let res = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await ctx.post('/api/v1/auth/login', {
        data: { email: account.email, password: account.password },
        timeout: 15_000,
      });
      if (r.ok()) {
        res = r;
        break;
      }
      lastError = `HTTP ${r.status()}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  if (!res) {
    throw new Error(
      `[e2e global-setup] login failed for ${account.email} after retries (${lastError}). ` +
        'Ensure the API is up and `seed` + `seed:workshop` have run against the target DB.',
    );
  }
  const { data } = (await res.json()) as { data: { token: string; user: unknown } };
  const url = new URL(BASE_URL);

  const state = {
    cookies: [
      {
        name: 'trace_auth',
        value: data.token,
        domain: url.hostname,
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: url.protocol === 'https:',
        sameSite: 'Strict' as const,
      },
    ],
    origins: [
      {
        origin: url.origin,
        localStorage: [
          { name: 'trace_token', value: data.token },
          { name: 'trace_user', value: JSON.stringify(data.user) },
        ],
      },
    ],
  };

  await writeFile(statePath(account.role), JSON.stringify(state, null, 2));
  await ctx.dispose();
}

export default async function globalSetup(): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  for (const account of Object.values(ACCOUNTS)) {
    await mintState(account);
  }
}
