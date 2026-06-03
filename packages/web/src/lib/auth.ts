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

export interface SessionState {
  token: string | null;
  user: StoredUser | null;
}

export function getPostAuthRedirect(user: StoredUser): string {
  return user.role === 'buyer' ? '/marketplace' : '/dashboard';
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isJwtExpired(token)) {
    clearSession();
    return null;
  }
  return token;
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

export function getSession(): SessionState {
  return {
    token: getToken(),
    user: getUser(),
  };
}

export function saveSession(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Also persist to a cookie so Next.js middleware can enforce server-side auth
  document.cookie = `trace_auth=${token}; path=/; SameSite=Strict`;
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = 'trace_auth=; path=/; max-age=0';
}

export function isHubStaff(user: StoredUser | null): boolean {
  return user?.role === 'hub_staff' || user?.role === 'hub_admin' || user?.role === 'platform_admin';
}
