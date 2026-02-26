'use client';

/**
 * Client-side auth utilities.
 * Token is stored in localStorage (simple for now; use httpOnly cookie in prod).
 */

const TOKEN_KEY = 'trace_token';
const USER_KEY = 'trace_user';

export interface StoredUser {
  id: string;
  email: string;
  role: string;
  organisationId: string | null;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isHubStaff(user: StoredUser | null): boolean {
  return user?.role === 'hub_staff' || user?.role === 'hub_admin' || user?.role === 'platform_admin';
}
