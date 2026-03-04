import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import {
  db,
  listings,
  transactions,
  materialPassports,
  passportEvents,
  type Listing,
  type Transaction,
} from '@trace/db';
import {
  type CreateListingInput,
  type UpdateListingInput,
  type MakeOfferInput,
  type MarketplaceQueryInput,
  type UpdateTransactionInput,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@trace/core';

// ─── Listing: Create ─────────────────────────────────────────────────────────

export async function createListing(
  input: CreateListingInput,
  sellerId: string,
  organisationId: string,
): Promise<Listing> {
  // Verify passport exists and belongs to seller's org
  const passport = await db.query.materialPassports.findFirst({
    where: eq(materialPassports.id, input.passportId),
  });

  if (!passport) throw new NotFoundError(`Passport ${input.passportId} not found`);
  if (passport.organisationId !== organisationId) {
    throw new ForbiddenError('Passport does not belong to your organisation');
  }
  if (passport.status === 'listed' || passport.status === 'reserved' || passport.status === 'sold') {
    throw new ConflictError('Passport is already listed or sold');
  }
  if (passport.status === 'decommissioned') {
    throw new ConflictError('Decommissioned materials cannot be listed');
  }

  const [listing] = await db
    .insert(listings)
    .values({
      passportId: input.passportId,
      organisationId,
      sellerId,
      pricePence: input.pricePence,
      currency: input.currency,
      quantity: input.quantity,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shippingOptions: input.shippingOptions as any,
      status: 'active',
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  if (!listing) throw new Error('Failed to insert listing');

  // Update passport status to listed
  await db
    .update(materialPassports)
    .set({ status: 'listed', updatedAt: new Date() })
    .where(eq(materialPassports.id, input.passportId));

  // EPCIS event
  await db.insert(passportEvents).values({
    passportId: input.passportId,
    eventType: 'ObjectEvent',
    eventData: {
      action: 'OBSERVE',
      bizStep: 'urn:epcglobal:cbv:bizstep:offering_for_sale',
      disposition: 'urn:epcglobal:cbv:disp:sellable_accessible',
      listingId: listing.id,
    },
    actorId: sellerId,
  });

  return listing;
}

// ─── Listing: Read ───────────────────────────────────────────────────────────

export interface ListingWithPassport extends Listing {
  passport: {
    productName: string;
    categoryL1: string;
    categoryL2: string | null;
    conditionGrade: string | null;
    conditionNotes: string | null;
    carbonSavingsVsNew: string | null;
    qrCodeUrl: string | null;
  };
  organisation: {
    name: string;
    slug: string;
  };
}

export async function getListingById(listingId: string): Promise<ListingWithPassport> {
  const listing = await db.query.listings.findFirst({
    where: eq(listings.id, listingId),
    with: {
      passport: {
        columns: {
          productName: true,
          categoryL1: true,
          categoryL2: true,
          conditionGrade: true,
          conditionNotes: true,
          carbonSavingsVsNew: true,
          qrCodeUrl: true,
        },
      },
      organisation: {
        columns: { name: true, slug: true },
      },
    },
  });

  if (!listing) throw new NotFoundError(`Listing ${listingId} not found`);

  return listing as unknown as ListingWithPassport;
}

export async function searchListings(
  query: MarketplaceQueryInput,
): Promise<{ data: ListingWithPassport[]; total: number; page: number; limit: number }> {
  // Build conditions on the join result — we query listings + join passport data
  const conditions = [eq(listings.status, 'active')];

  if (query.minPricePence !== undefined) {
    conditions.push(gte(listings.pricePence, query.minPricePence));
  }
  if (query.maxPricePence !== undefined) {
    conditions.push(lte(listings.pricePence, query.maxPricePence));
  }

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  // Sort column mapping
  const sortColMap = {
    createdAt: listings.createdAt,
    pricePence: listings.pricePence,
    carbonSavingsVsNew: listings.createdAt, // fallback; carbon is on passport side
  } as const;
  const sortCol = sortColMap[query.sortBy] ?? listings.createdAt;
  const orderFn = query.sortOrder === 'asc' ? asc : desc;

  const [data, countResult] = await Promise.all([
    db.query.listings.findMany({
      where,
      orderBy: [orderFn(sortCol)],
      limit: query.limit,
      offset,
      with: {
        passport: {
          columns: {
            productName: true,
            categoryL1: true,
            categoryL2: true,
            conditionGrade: true,
            conditionNotes: true,
            carbonSavingsVsNew: true,
            qrCodeUrl: true,
          },
        },
        organisation: {
          columns: { name: true, slug: true },
        },
      },
    }),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(listings).where(where),
  ]);

  // Post-filter by passport fields (categoryL1, categoryL2, conditionGrade, q, hubSlug)
  // Drizzle relations don't support WHERE on joined tables in findMany easily;
  // we filter in-memory for the prototype. Production would use raw SQL.
  let filtered = data as unknown as ListingWithPassport[];

  if (query.categoryL1) {
    filtered = filtered.filter((l) => l.passport.categoryL1 === query.categoryL1);
  }
  if (query.categoryL2) {
    filtered = filtered.filter((l) => l.passport.categoryL2 === query.categoryL2);
  }
  if (query.conditionGrade) {
    filtered = filtered.filter((l) => l.passport.conditionGrade === query.conditionGrade);
  }
  if (query.hubSlug) {
    filtered = filtered.filter((l) => l.organisation.slug === query.hubSlug);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.passport.productName.toLowerCase().includes(q) ||
        l.passport.categoryL1.toLowerCase().includes(q) ||
        (l.passport.conditionNotes ?? '').toLowerCase().includes(q),
    );
  }

  return {
    data: filtered,
    total: countResult[0]?.count ?? 0,
    page: query.page,
    limit: query.limit,
  };
}

export async function listHubListings(
  organisationId: string,
): Promise<ListingWithPassport[]> {
  const data = await db.query.listings.findMany({
    where: eq(listings.organisationId, organisationId),
    orderBy: [desc(listings.createdAt)],
    with: {
      passport: {
        columns: {
          productName: true,
          categoryL1: true,
          categoryL2: true,
          conditionGrade: true,
          conditionNotes: true,
          carbonSavingsVsNew: true,
          qrCodeUrl: true,
        },
      },
      organisation: {
        columns: { name: true, slug: true },
      },
    },
  });

  return data as unknown as ListingWithPassport[];
}

// ─── Listing: Update / Cancel ────────────────────────────────────────────────

export async function updateListing(
  listingId: string,
  input: UpdateListingInput,
  organisationId: string,
): Promise<Listing> {
  const listing = await db.query.listings.findFirst({
    where: eq(listings.id, listingId),
  });

  if (!listing) throw new NotFoundError(`Listing ${listingId} not found`);
  if (listing.organisationId !== organisationId) {
    throw new ForbiddenError('Listing does not belong to your organisation');
  }
  if (listing.status !== 'active') {
    throw new ConflictError(`Cannot update listing with status '${listing.status}'`);
  }

  const updateSet: Record<string, unknown> = {};
  if (input.pricePence !== undefined) updateSet['pricePence'] = input.pricePence;
  if (input.quantity !== undefined) updateSet['quantity'] = input.quantity;
  if (input.shippingOptions !== undefined) updateSet['shippingOptions'] = input.shippingOptions;
  if (input.expiresAt !== undefined) updateSet['expiresAt'] = input.expiresAt;

  const [updated] = await db
    .update(listings)
    .set(updateSet)
    .where(eq(listings.id, listingId))
    .returning();

  if (!updated) throw new Error('Update failed');
  return updated;
}

export async function cancelListing(
  listingId: string,
  organisationId: string,
): Promise<Listing> {
  const listing = await db.query.listings.findFirst({
    where: eq(listings.id, listingId),
  });

  if (!listing) throw new NotFoundError(`Listing ${listingId} not found`);
  if (listing.organisationId !== organisationId) {
    throw new ForbiddenError('Listing does not belong to your organisation');
  }
  if (!['active', 'reserved'].includes(listing.status)) {
    throw new ConflictError(`Cannot cancel listing with status '${listing.status}'`);
  }

  const [cancelled] = await db
    .update(listings)
    .set({ status: 'cancelled' })
    .where(eq(listings.id, listingId))
    .returning();

  if (!cancelled) throw new Error('Cancel failed');

  // Revert passport status to active
  await db
    .update(materialPassports)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(materialPassports.id, listing.passportId));

  return cancelled;
}

// ─── Transaction: Make Offer ─────────────────────────────────────────────────

export async function makeOffer(
  input: MakeOfferInput,
  buyerId: string,
): Promise<Transaction> {
  const listing = await db.query.listings.findFirst({
    where: eq(listings.id, input.listingId),
  });

  if (!listing) throw new NotFoundError(`Listing ${input.listingId} not found`);
  if (listing.status !== 'active') {
    throw new ConflictError(`Listing is not available (status: ${listing.status})`);
  }
  if (listing.sellerId === buyerId) {
    throw new ForbiddenError('Cannot buy your own listing');
  }

  // Check for expired listing
  if (listing.expiresAt && listing.expiresAt < new Date()) {
    await db.update(listings).set({ status: 'expired' }).where(eq(listings.id, listing.id));
    throw new ConflictError('Listing has expired');
  }

  const amountPence = input.offerPencE ?? listing.pricePence;

  // Dispute deadline: 48 hours after offer
  const disputeDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [tx] = await db
    .insert(transactions)
    .values({
      listingId: input.listingId,
      buyerId,
      sellerId: listing.sellerId,
      amountPence,
      status: 'pending',
      disputeDeadline,
      notes: input.notes ?? null,
    })
    .returning();

  if (!tx) throw new Error('Failed to create transaction');

  // Reserve the listing
  await db
    .update(listings)
    .set({ status: 'reserved' })
    .where(eq(listings.id, listing.id));

  // Reserve passport
  await db
    .update(materialPassports)
    .set({ status: 'reserved', updatedAt: new Date() })
    .where(eq(materialPassports.id, listing.passportId));

  return tx;
}

// ─── Transaction: Update Status ──────────────────────────────────────────────

export async function updateTransaction(
  transactionId: string,
  input: UpdateTransactionInput,
  userId: string,
): Promise<Transaction> {
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    with: { listing: true },
  });

  if (!tx) throw new NotFoundError(`Transaction ${transactionId} not found`);

  // Permission checks by action
  if (input.action === 'confirm_delivery' && tx.buyerId !== userId) {
    throw new ForbiddenError('Only the buyer can confirm delivery');
  }
  if (input.action === 'cancel' && tx.sellerId !== userId && tx.buyerId !== userId) {
    throw new ForbiddenError('Only buyer or seller can cancel');
  }
  if (input.action === 'flag_dispute' && tx.buyerId !== userId) {
    throw new ForbiddenError('Only the buyer can flag a dispute');
  }

  let newStatus: string;

  switch (input.action) {
    case 'confirm_delivery':
      if (tx.status !== 'pending' && tx.status !== 'confirmed') {
        throw new ConflictError(`Cannot confirm delivery on transaction with status '${tx.status}'`);
      }
      newStatus = 'confirmed';
      break;

    case 'flag_dispute':
      if (tx.status !== 'pending' && tx.status !== 'confirmed') {
        throw new ConflictError(`Cannot flag dispute on transaction with status '${tx.status}'`);
      }
      newStatus = 'disputed';
      break;

    case 'resolve_dispute':
      if (tx.status !== 'disputed') {
        throw new ConflictError('Transaction is not in disputed state');
      }
      newStatus = 'resolved';
      break;

    case 'cancel':
      if (!['pending', 'confirmed'].includes(tx.status)) {
        throw new ConflictError(`Cannot cancel transaction with status '${tx.status}'`);
      }
      newStatus = 'cancelled';
      // Revert listing and passport
      await db.update(listings).set({ status: 'active' }).where(eq(listings.id, tx.listingId));
      await db
        .update(materialPassports)
        .set({ status: 'listed', updatedAt: new Date() })
        .where(eq(materialPassports.id, (tx as any).listing.passportId));
      break;

    default:
      throw new ConflictError('Unknown action');
  }

  const updateSet: Record<string, unknown> = { status: newStatus };
  if (input.notes) updateSet['notes'] = input.notes;

  // If confirmed and past dispute deadline, auto-complete
  if (newStatus === 'confirmed' && tx.disputeDeadline && tx.disputeDeadline < new Date()) {
    updateSet['status'] = 'completed';
    newStatus = 'completed';
  }

  if (newStatus === 'completed') {
    // Mark listing sold, passport sold
    await db.update(listings).set({ status: 'sold' }).where(eq(listings.id, tx.listingId));
    await db
      .update(materialPassports)
      .set({ status: 'sold', updatedAt: new Date() })
      .where(eq(materialPassports.id, (tx as any).listing.passportId));

    // EPCIS transfer event
    await db.insert(passportEvents).values({
      passportId: (tx as any).listing.passportId,
      eventType: 'TransactionEvent',
      eventData: {
        action: 'ADD',
        bizStep: 'urn:epcglobal:cbv:bizstep:selling',
        disposition: 'urn:epcglobal:cbv:disp:sold',
        transactionId,
        buyerId: tx.buyerId,
        amountPence: tx.amountPence,
      },
      actorId: userId,
    });
  }

  const [updated] = await db
    .update(transactions)
    .set(updateSet)
    .where(eq(transactions.id, transactionId))
    .returning();

  if (!updated) throw new Error('Update failed');
  return updated;
}

export async function getTransactionById(transactionId: string): Promise<Transaction> {
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
  });
  if (!tx) throw new NotFoundError(`Transaction ${transactionId} not found`);
  return tx;
}

export async function listUserTransactions(userId: string): Promise<Transaction[]> {
  const data = await db.query.transactions.findMany({
    where: and(
      // buyer or seller
      sql`(${transactions.buyerId} = ${userId} OR ${transactions.sellerId} = ${userId})`,
    ),
    orderBy: [desc(transactions.createdAt)],
  });
  return data;
}
