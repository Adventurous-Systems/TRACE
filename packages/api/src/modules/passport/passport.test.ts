import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, getAuthHeader, type TestApp } from '../../test-utils.js';

// Uses credentials created by: pnpm db:seed
const SEEDED_ADMIN = {
  email: 'admin@stirlingreuse.com',
  password: 'Admin1234!',
};

const VALID_PASSPORT_PAYLOAD = {
  productName: 'Reclaimed Steel I-Beam',
  categoryL1: 'structural-steel',
  categoryL2: 'i-beams',
  conditionGrade: 'B',
  materialComposition: [{ material: 'Steel', percentage: 100, recycled: true }],
};

describe('POST /api/v1/passports', () => {
  let app: TestApp;
  let authHeader: { authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    authHeader = await getAuthHeader(app, SEEDED_ADMIN.email, SEEDED_ADMIN.password);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a passport and returns 201 with valid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/passports',
      headers: authHeader,
      payload: VALID_PASSPORT_PAYLOAD,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ success: boolean; data: { id: string; productName: string; status: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();
    expect(body.data.productName).toBe(VALID_PASSPORT_PAYLOAD.productName);
    expect(body.data.status).toBe('active');
  });

  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/passports',
      payload: VALID_PASSPORT_PAYLOAD,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/passports',
      headers: authHeader,
      payload: { categoryL1: 'structural-steel' }, // missing productName
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid categoryL1', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/passports',
      headers: authHeader,
      payload: { ...VALID_PASSPORT_PAYLOAD, categoryL1: 'not-a-real-category' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/passports', () => {
  let app: TestApp;
  let authHeader: { authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    authHeader = await getAuthHeader(app, SEEDED_ADMIN.email, SEEDED_ADMIN.password);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with paginated results for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/passports',
      headers: authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { items: unknown[]; total: number } }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(typeof body.data.total).toBe('number');
  });

  it('returns 401 without authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/passports' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/passports/:id', () => {
  let app: TestApp;
  let authHeader: { authorization: string };
  let createdId: string;

  beforeAll(async () => {
    app = await createTestApp();
    authHeader = await getAuthHeader(app, SEEDED_ADMIN.email, SEEDED_ADMIN.password);

    // Create a passport to retrieve
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/passports',
      headers: authHeader,
      payload: VALID_PASSPORT_PAYLOAD,
    });
    createdId = res.json<{ data: { id: string } }>().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 for a known passport ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/passports/${createdId}`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdId);
  });

  it('returns 404 for an unknown passport ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/passports/00000000-0000-0000-0000-000000000000',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/v1/passports/:id', () => {
  let app: TestApp;
  let authHeader: { authorization: string };
  let createdId: string;

  beforeAll(async () => {
    app = await createTestApp();
    authHeader = await getAuthHeader(app, SEEDED_ADMIN.email, SEEDED_ADMIN.password);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/passports',
      headers: authHeader,
      payload: VALID_PASSPORT_PAYLOAD,
    });
    createdId = res.json<{ data: { id: string } }>().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('updates a passport with partial data and returns 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/passports/${createdId}`,
      headers: authHeader,
      payload: { conditionGrade: 'A', conditionNotes: 'Inspected and approved' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { conditionGrade: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.conditionGrade).toBe('A');
  });

  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/passports/${createdId}`,
      payload: { conditionGrade: 'A' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/passports/:id/verify', () => {
  let app: TestApp;
  let authHeader: { authorization: string };
  let createdId: string;

  beforeAll(async () => {
    app = await createTestApp();
    authHeader = await getAuthHeader(app, SEEDED_ADMIN.email, SEEDED_ADMIN.password);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/passports',
      headers: authHeader,
      payload: VALID_PASSPORT_PAYLOAD,
    });
    createdId = res.json<{ data: { id: string } }>().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns verified status and onchainVerified field', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/passports/${createdId}/verify`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      success: boolean;
      data: { verified: boolean; onchainVerified: boolean | null };
    }>();
    expect(body.success).toBe(true);
    // Newly created passport is not yet anchored
    expect(body.data.verified).toBe(false);
    // onchainVerified is null when MATERIAL_REGISTRY_ADDRESS is not configured
    expect(body.data.onchainVerified === null || typeof body.data.onchainVerified === 'boolean').toBe(true);
  });

  it('returns 404 for unknown passport ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/passports/00000000-0000-0000-0000-000000000000/verify',
    });

    expect(res.statusCode).toBe(404);
  });
});
