import bcrypt from 'bcrypt';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, organisations, users } from '@trace/db';
import { createTestApp, getAuthHeader, type TestApp } from '../../test-utils.js';

const SEEDED_BUYER = {
  email: 'buyer@example.com',
  password: 'Buyer1234!',
};

describe('access request flow', () => {
  let app: TestApp;
  let buyerAuth: { authorization: string };
  let platformAdminAuth: { authorization: string };
  let organisationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    buyerAuth = await getAuthHeader(app, SEEDED_BUYER.email, SEEDED_BUYER.password);

    const organisation = await db.query.organisations.findFirst({
      where: eq(organisations.slug, 'stirling'),
    });
    organisationId = organisation!.id;

    const email = `platform-admin-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('Platform1234!', 10);
    await db.insert(users).values({
      email,
      passwordHash,
      name: 'Platform Admin',
      role: 'platform_admin',
      organisationId: null,
    });

    platformAdminAuth = await getAuthHeader(app, email, 'Platform1234!');
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a buyer to submit an access request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/access-requests',
      headers: buyerAuth,
      payload: {
        requestedRole: 'hub_staff',
        organisationName: 'Stirling Reuse Hub',
        notes: 'Beta seller testing',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ success: boolean; data: { status: string; requestedRole: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
    expect(body.data.requestedRole).toBe('hub_staff');
  });

  it('lists a buyer request in /mine', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/access-requests/mine',
      headers: buyerAuth,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: Array<{ status: string }> }>();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]?.status).toBe('pending');
  });

  it('allows a platform admin to approve a pending request', async () => {
    const pending = await app.inject({
      method: 'GET',
      url: '/api/v1/access-requests?status=pending',
      headers: platformAdminAuth,
    });

    expect(pending.statusCode).toBe(200);
    const pendingBody = pending.json<{ data: Array<{ id: string; userId: string }> }>();
    const request = pendingBody.data.find((item) => item.userId);
    expect(request).toBeTruthy();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/access-requests/${request!.id}/approve`,
      headers: platformAdminAuth,
      payload: {
        role: 'hub_staff',
        organisationId,
        reviewNotes: 'Approved for beta hub testing',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      success: boolean;
      data: {
        status: string;
        targetOrganisationId: string | null;
        user: { role: string; organisationId: string | null };
      };
    }>();

    expect(body.success).toBe(true);
    expect(body.data.status).toBe('approved');
    expect(body.data.targetOrganisationId).toBe(organisationId);
    expect(body.data.user.role).toBe('hub_staff');
    expect(body.data.user.organisationId).toBe(organisationId);
  });

  it('allows a platform admin to reject a pending request', async () => {
    const buyerEmail = `buyer-reject-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('BuyerReject123!', 10);
    const [buyer] = await db.insert(users).values({
      email: buyerEmail,
      passwordHash,
      name: 'Buyer Reject',
      role: 'buyer',
      organisationId: null,
    }).returning();

    const rejectBuyerAuth = await getAuthHeader(app, buyerEmail, 'BuyerReject123!');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/access-requests',
      headers: rejectBuyerAuth,
      payload: {
        requestedRole: 'hub_admin',
        organisationName: 'Another Hub',
        notes: 'Need review',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json<{ data: { id: string } }>();

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/access-requests/${created.data.id}/reject`,
      headers: platformAdminAuth,
      payload: {
        reviewNotes: 'Not enough information yet',
      },
    });

    expect(rejectRes.statusCode).toBe(200);
    const body = rejectRes.json<{ success: boolean; data: { status: string; reviewNotes: string | null } }>();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('rejected');
    expect(body.data.reviewNotes).toBe('Not enough information yet');

    const unchangedBuyer = await db.query.users.findFirst({
      where: eq(users.id, buyer!.id),
    });
    expect(unchangedBuyer?.role).toBe('buyer');
    expect(unchangedBuyer?.organisationId).toBeNull();
  });
});
