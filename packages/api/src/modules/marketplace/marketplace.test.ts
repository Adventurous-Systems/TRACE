import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import {
  auditEvents,
  db,
  listings,
  materialPassports,
  organisations,
  users,
} from '@trace/db';
import { createTestApp, getAuthHeader, type TestApp } from '../../test-utils.js';

describe('marketplace buyer flow', () => {
  let app: TestApp;
  let buyerAuth: { authorization: string };
  let listingId: string;
  let buyerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const buyerEmail = `walletless-buyer-${Date.now()}@example.com`;
    const [buyer] = await db
      .insert(users)
      .values({
        email: buyerEmail,
        passwordHash: await bcrypt.hash('Buyer1234!', 10),
        name: 'Walletless Buyer',
        role: 'buyer',
        organisationId: null,
      })
      .returning();
    buyerId = buyer!.id;
    buyerAuth = await getAuthHeader(app, buyerEmail, 'Buyer1234!');

    const org = await db.query.organisations.findFirst({
      where: eq(organisations.slug, 'stirling'),
    });
    const seller = await db.query.users.findFirst({
      where: eq(users.email, 'staff@stirlingreuse.com'),
    });

    const [passport] = await db
      .insert(materialPassports)
      .values({
        organisationId: org!.id,
        registeredBy: seller!.id,
        productName: `Walletless Buyer Test ${Date.now()}`,
        categoryL1: 'masonry',
        conditionGrade: 'B',
        status: 'active',
      })
      .returning();

    const [listing] = await db
      .insert(listings)
      .values({
        passportId: passport!.id,
        organisationId: org!.id,
        sellerId: seller!.id,
        pricePence: 12500,
        currency: 'GBP',
        quantity: 1,
        shippingOptions: [{ method: 'collection' }],
        status: 'active',
      })
      .returning();

    listingId = listing!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a buyer without an organisation make an offer and logs the walletless model', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/offers',
      headers: buyerAuth,
      payload: { listingId, notes: 'Walletless buyer test offer' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ data: { id: string; buyerId: string; amountPence: number } }>();
    expect(body.data.buyerId).toBe(buyerId);
    expect(body.data.amountPence).toBe(12500);

    const event = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.resourceId, body.data.id),
    });
    expect(event?.action).toBe('marketplace.offer');
    expect(event?.metadata['buyerModel']).toBe('walletless_buyer');
  });
});
