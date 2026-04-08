/**
 * Typed API client for the TRACE backend.
 * Used in both server components (directly) and client components (via TanStack Query).
 */

function getApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  // In the browser, default to same-origin so staging/prod works behind a reverse proxy.
  // Keep localhost DX by defaulting to API on :3001 when running web on :3000.
  if (typeof window !== 'undefined') {
    const { hostname, protocol, port } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    if (isLocalHost && port === '3000') {
      return `${protocol}//${hostname}:3001`;
    }
    return window.location.origin;
  }

  // Server-side fallback for local dev and server components.
  return (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

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

  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to reach TRACE API. Check NEXT_PUBLIC_API_URL or reverse-proxy routing.',
      0,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      'API returned a non-JSON response',
      res.status,
    );
  }

  const payload = json as
    | { success: true; data: T }
    | { success: false; error: { code?: string; message?: string } };

  if (payload.success === true) {
    return payload.data;
  }

  if (payload.success === false) {
    throw new ApiError(
      payload.error.code ?? 'API_ERROR',
      payload.error.message ?? 'Request failed',
      res.status,
    );
  }

  throw new ApiError(
    'INVALID_RESPONSE',
    'API returned an unexpected response shape',
    res.status,
  );
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

export interface AccessRequest {
  id: string;
  userId: string;
  requestedRole: 'hub_staff' | 'hub_admin';
  organisationName: string | null;
  targetOrganisationId: string | null;
  notes: string | null;
  reviewNotes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequestReview extends AccessRequest {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organisationId: string | null;
  } | null;
  targetOrganisation?: {
    id: string;
    name: string;
    slug: string;
    type: string;
    verified: boolean;
  } | null;
  reviewer?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organisationId: string | null;
  } | null;
}

export interface AccessRequestOrganisation {
  id: string;
  name: string;
  slug: string;
  type: string;
  verified: boolean;
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
  }) =>
    request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: (token: string) =>
    request<AuthResponse['user']>('/api/v1/auth/me', { token }),
};

export const accessRequests = {
  submit: (
    data: {
      requestedRole: 'hub_staff' | 'hub_admin';
      organisationName: string;
      notes?: string;
    },
    token: string,
  ) =>
    request<AccessRequest>('/api/v1/access-requests', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  mine: (token: string) =>
    request<AccessRequest[]>('/api/v1/access-requests/mine', { token }),

  list: (
    token: string,
    status?: 'pending' | 'approved' | 'rejected',
  ) =>
    request<AccessRequestReview[]>(
      `/api/v1/access-requests${status ? `?status=${status}` : ''}`,
      { token },
    ),

  organisations: (token: string) =>
    request<AccessRequestOrganisation[]>('/api/v1/access-requests/organisations', { token }),

  approve: (
    id: string,
    data: {
      role: 'hub_staff' | 'hub_admin';
      organisationId: string;
      reviewNotes?: string;
    },
    token: string,
  ) =>
    request<AccessRequestReview>(`/api/v1/access-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  reject: (
    id: string,
    data: {
      reviewNotes?: string;
    },
    token: string,
  ) =>
    request<AccessRequest>(`/api/v1/access-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
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
  reclaimedBy: string | null;
  remainingLifeEstimate: number | null;
  carbonSavingsVsNew: string | null;
  handlingRequirements: string | null;
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

// ─── Marketplace ──────────────────────────────────────────────────────────

export interface ListingPassport {
  productName: string;
  categoryL1: string;
  categoryL2: string | null;
  conditionGrade: string | null;
  conditionNotes: string | null;
  carbonSavingsVsNew: string | null;
  qrCodeUrl: string | null;
}

export interface ListingShippingOption {
  method: string;
  deliveryRadiusMiles?: number;
  deliveryCostPence?: number;
  notes?: string;
}

export interface ListingSummary {
  id: string;
  passportId: string;
  organisationId: string;
  sellerId: string;
  pricePence: number;
  currency: string;
  quantity: number;
  shippingOptions: ListingShippingOption[];
  status: string;
  expiresAt: string | null;
  createdAt: string;
  passport: ListingPassport;
  organisation: { name: string; slug: string };
}

export interface MarketplaceListResponse {
  data: ListingSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface MarketplaceTransaction {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amountPence: number;
  status: string;
  disputeDeadline: string | null;
  notes: string | null;
  createdAt: string;
}

export const marketplace = {
  search: (params: URLSearchParams) =>
    request<MarketplaceListResponse>(`/api/v1/marketplace/listings?${params.toString()}`),

  hubListings: (token: string) =>
    request<ListingSummary[]>('/api/v1/marketplace/listings/hub', { token }),

  getListing: (id: string) =>
    request<ListingSummary>(`/api/v1/marketplace/listings/${id}`),

  createListing: (data: unknown, token: string) =>
    request<ListingSummary>('/api/v1/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  cancelListing: (id: string, token: string) =>
    request<ListingSummary>(`/api/v1/marketplace/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
      token,
    }),

  makeOffer: (data: { listingId: string; offerPencE?: number; notes?: string }, token: string) =>
    request<MarketplaceTransaction>('/api/v1/marketplace/offers', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  transactions: (token: string) =>
    request<MarketplaceTransaction[]>('/api/v1/marketplace/transactions', { token }),

  updateTransaction: (id: string, action: string, token: string, notes?: string) =>
    request<MarketplaceTransaction>(`/api/v1/marketplace/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, notes }),
      token,
    }),
};

// ─── Quality ──────────────────────────────────────────────────────────────

export interface QualityReportSummary {
  id: string;
  passportId: string;
  inspectorId: string;
  structuralScore: number | null;
  aestheticScore: number | null;
  environmentalScore: number | null;
  overallGrade: 'A' | 'B' | 'C' | 'D' | null;
  reportNotes: string | null;
  photoUrls: string[];
  blockchainTxHash: string | null;
  disputed: boolean;
  createdAt: string;
  inspector: { id: string; name: string; email: string } | null;
}

export const quality = {
  getForPassport: (passportId: string) =>
    request<QualityReportSummary[]>(`/api/v1/quality/reports/passport/${passportId}`),

  getReport: (id: string) =>
    request<QualityReportSummary>(`/api/v1/quality/reports/${id}`),

  myReports: (token: string) =>
    request<QualityReportSummary[]>('/api/v1/quality/reports/mine', { token }),

  submit: (data: {
    passportId: string;
    structuralScore?: number;
    aestheticScore?: number;
    environmentalScore?: number;
    overallGrade?: 'A' | 'B' | 'C' | 'D';
    reportNotes?: string;
    photoUrls?: string[];
  }, token: string) =>
    request<QualityReportSummary>('/api/v1/quality/reports', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  dispute: (reportId: string, token: string) =>
    request<QualityReportSummary>(`/api/v1/quality/reports/${reportId}/dispute`, {
      method: 'POST',
      token,
    }),
};

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
