/**
 * Typed API client for the TRACE backend.
 * Used in both server components (directly) and client components (via TanStack Query).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  const json = (await res.json()) as
    | { success: true; data: T }
    | { success: false; error: { code: string; message: string } };

  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, res.status);
  }

  return json.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    organisationId: string | null;
  };
}

export const auth = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    organisationId?: string;
  }) =>
    request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: (token: string) =>
    request<AuthResponse['user']>('/api/v1/auth/me', { token }),
};

// ─── Passports ───────────────────────────────────────────────────────────

export interface PassportSummary {
  id: string;
  productName: string;
  categoryL1: string;
  categoryL2: string | null;
  conditionGrade: string | null;
  status: string;
  qrCodeUrl: string | null;
  blockchainTxHash: string | null;
  blockchainAnchoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PassportDetail extends PassportSummary {
  organisationId: string;
  gtin: string | null;
  serialNumber: string | null;
  digitalLinkUri: string | null;
  materialComposition: Array<{ material: string; percentage?: number; recycled?: boolean }>;
  dimensions: { length?: number; width?: number; height?: number; weight?: number; unit: string; weightUnit?: string } | null;
  technicalSpecs: Record<string, unknown>;
  manufacturerName: string | null;
  countryOfOrigin: string | null;
  productionDate: string | null;
  gwpTotal: string | null;
  embodiedCarbon: string | null;
  recycledContent: string | null;
  epdReference: string | null;
  ceMarking: boolean;
  conditionNotes: string | null;
  conditionPhotos: string[];
  previousBuildingId: string | null;
  deconstructionDate: string | null;
  deconstructionMethod: string | null;
  remainingLifeEstimate: number | null;
  carbonSavingsVsNew: string | null;
  hazardousSubstances: Array<{ name: string; casNumber?: string; concentration?: string; hazardClass?: string }>;
  blockchainPassportHash: string | null;
  verified?: boolean;
}

export interface PassportListResponse {
  data: PassportSummary[];
  total: number;
  page: number;
  limit: number;
}

export const passports = {
  list: (params: URLSearchParams, token: string) =>
    request<PassportListResponse>(`/api/v1/passports?${params.toString()}`, { token }),

  get: (id: string, token?: string) =>
    request<PassportDetail>(`/api/v1/passports/${id}`, token ? { token } : {}),

  verify: (id: string) =>
    request<PassportDetail & { verified: boolean }>(`/api/v1/passports/${id}/verify`),

  create: (data: unknown, token: string) =>
    request<PassportDetail>('/api/v1/passports', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: unknown, token: string) =>
    request<PassportDetail>(`/api/v1/passports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  history: (id: string) =>
    request<unknown[]>(`/api/v1/passports/${id}/history`),
};
