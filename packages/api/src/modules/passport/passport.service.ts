import { eq, and, ilike, sql, desc } from 'drizzle-orm';
import { db, materialPassports, passportEvents, type MaterialPassport } from '@trace/db';
import {
  type CreatePassportInput,
  type UpdatePassportInput,
  type PassportQueryInput,
  NotFoundError,
  ForbiddenError,
} from '@trace/core';
import QRCode from 'qrcode';
import { anchorQueue } from '../../lib/queue.js';
import { uploadBuffer } from '../../lib/storage.js';
import { env } from '../../env.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PassportWithVerification extends MaterialPassport {
  verified?: boolean;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createPassport(
  input: CreatePassportInput,
  userId: string,
  organisationId: string,
): Promise<MaterialPassport> {
  // Insert passport record (status = draft, no blockchain hash yet)
  const insertData = buildInsertValues(input);
  if (!insertData.productName || !insertData.categoryL1) {
    throw new Error('productName and categoryL1 are required');
  }
  const [passport] = await db
    .insert(materialPassports)
    .values({
      ...insertData,
      productName: insertData.productName,
      categoryL1: insertData.categoryL1,
      organisationId,
      registeredBy: userId,
      status: 'draft',
    })
    .returning();

  if (!passport) throw new Error('Failed to insert passport');

  // Generate QR code pointing to the public passport URL
  const publicUrl = `${env.WEB_URL}/passport/${passport.id}`;
  const qrBuffer = await QRCode.toBuffer(publicUrl, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'H',
  });

  const qrKey = `passports/${passport.id}/qr.png`;
  const qrCodeUrl = await uploadBuffer(
    env.MINIO_BUCKET_PASSPORTS,
    qrKey,
    qrBuffer,
    'image/png',
  );

  // Update with QR code URL and mark as active
  const [updated] = await db
    .update(materialPassports)
    .set({
      qrCodeUrl,
      digitalLinkUri: publicUrl,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(materialPassports.id, passport.id))
    .returning();

  // Log creation event
  await db.insert(passportEvents).values({
    passportId: passport.id,
    eventType: 'ObjectEvent',
    eventData: {
      action: 'ADD',
      bizStep: 'urn:epcglobal:cbv:bizstep:commissioning',
      disposition: 'urn:epcglobal:cbv:disp:active',
    },
    actorId: userId,
  });

  // Enqueue blockchain anchoring job (non-blocking)
  await anchorQueue.add('default', { passportId: passport.id, organisationId }, {
    jobId: `anchor-${passport.id}`,
  });

  return updated ?? passport;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getPassportById(
  passportId: string,
  requestingOrgId?: string,
): Promise<MaterialPassport> {
  const passport = await db.query.materialPassports.findFirst({
    where: eq(materialPassports.id, passportId),
  });

  if (!passport) throw new NotFoundError(`Passport ${passportId} not found`);

  // Drafts are org-private
  if (passport.status === 'draft' && requestingOrgId !== passport.organisationId) {
    throw new NotFoundError(`Passport ${passportId} not found`);
  }

  return passport;
}

export async function listPassports(
  query: PassportQueryInput,
  organisationId: string,
): Promise<{ data: MaterialPassport[]; total: number; page: number; limit: number }> {
  const conditions = [eq(materialPassports.organisationId, organisationId)];

  if (query.status) {
    conditions.push(eq(materialPassports.status, query.status));
  }
  if (query.categoryL1) {
    conditions.push(eq(materialPassports.categoryL1, query.categoryL1));
  }
  if (query.categoryL2) {
    conditions.push(eq(materialPassports.categoryL2, query.categoryL2));
  }
  if (query.conditionGrade) {
    conditions.push(eq(materialPassports.conditionGrade, query.conditionGrade));
  }
  if (query.search) {
    conditions.push(ilike(materialPassports.productName, `%${query.search}%`));
  }

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [data, countResult] = await Promise.all([
    db.query.materialPassports.findMany({
      where,
      orderBy: [desc(materialPassports.createdAt)],
      limit: query.limit,
      offset,
    }),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(materialPassports)
      .where(where),
  ]);

  return {
    data,
    total: countResult[0]?.count ?? 0,
    page: query.page,
    limit: query.limit,
  };
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updatePassport(
  passportId: string,
  input: UpdatePassportInput,
  userId: string,
  organisationId: string,
): Promise<MaterialPassport> {
  const existing = await db.query.materialPassports.findFirst({
    where: eq(materialPassports.id, passportId),
  });

  if (!existing) throw new NotFoundError(`Passport ${passportId} not found`);
  if (existing.organisationId !== organisationId) {
    throw new ForbiddenError('You do not have permission to update this passport');
  }

  // Build update set, filtering out undefined values (partial update)
  const rawUpdate = buildInsertValues(input);
  const updateSet: Record<string, unknown> = {
    updatedAt: new Date(),
    blockchainPassportHash: null,
    blockchainTxHash: null,
    blockchainAnchoredAt: null,
  };
  for (const [k, v] of Object.entries(rawUpdate)) {
    if (v !== undefined) updateSet[k] = v;
  }

  const [updated] = await db
    .update(materialPassports)
    .set(updateSet)
    .where(eq(materialPassports.id, passportId))
    .returning();

  if (!updated) throw new Error('Update failed');

  // Log amendment event
  await db.insert(passportEvents).values({
    passportId,
    eventType: 'ObjectEvent',
    eventData: {
      action: 'OBSERVE',
      bizStep: 'urn:epcglobal:cbv:bizstep:inspecting',
      disposition: 'urn:epcglobal:cbv:disp:active',
      amendment: true,
    },
    actorId: userId,
  });

  // Re-queue blockchain anchor
  await anchorQueue.add('default', { passportId, organisationId }, {
    jobId: `anchor-${passportId}-${Date.now()}`,
  });

  return updated;
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Returns basic passport data plus on-chain verification status.
 * The actual hash comparison is done in the blockchain worker/service,
 * so here we just surface the stored anchor data.
 */
export async function verifyPassport(passportId: string): Promise<PassportWithVerification> {
  const passport = await db.query.materialPassports.findFirst({
    where: eq(materialPassports.id, passportId),
  });

  if (!passport) throw new NotFoundError(`Passport ${passportId} not found`);

  const verified =
    passport.blockchainTxHash !== null && passport.blockchainAnchoredAt !== null;

  return { ...passport, verified };
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function getPassportHistory(passportId: string): Promise<unknown[]> {
  const passport = await db.query.materialPassports.findFirst({
    where: eq(materialPassports.id, passportId),
  });
  if (!passport) throw new NotFoundError(`Passport ${passportId} not found`);

  return db.query.passportEvents.findMany({
    where: eq(passportEvents.passportId, passportId),
    orderBy: [desc(passportEvents.createdAt)],
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInsertValues(input: CreatePassportInput | UpdatePassportInput) {
  return {
    productName: input.productName,
    categoryL1: input.categoryL1,
    categoryL2: input.categoryL2 ?? null,
    materialComposition: input.materialComposition ?? [],
    dimensions: input.dimensions ?? null,
    technicalSpecs: input.technicalSpecs ?? {},
    manufacturerName: input.manufacturerName ?? null,
    countryOfOrigin: input.countryOfOrigin ?? null,
    productionDate: input.productionDate ?? null,
    gwpTotal: input.gwpTotal !== undefined ? String(input.gwpTotal) : null,
    embodiedCarbon: input.embodiedCarbon !== undefined ? String(input.embodiedCarbon) : null,
    recycledContent: input.recycledContent !== undefined ? String(input.recycledContent) : null,
    epdReference: input.epdReference ?? null,
    ceMarking: input.ceMarking ?? false,
    declarationOfPerformance: input.declarationOfPerformance ?? null,
    harmonisedStandard: input.harmonisedStandard ?? null,
    previousBuildingId: input.previousBuildingId ?? null,
    deconstructionDate: input.deconstructionDate ?? null,
    deconstructionMethod: input.deconstructionMethod ?? null,
    reclaimedBy: input.reclaimedBy ?? null,
    conditionGrade: input.conditionGrade ?? null,
    conditionNotes: input.conditionNotes ?? null,
    originalAge: input.originalAge ?? null,
    remainingLifeEstimate: input.remainingLifeEstimate ?? null,
    carbonSavingsVsNew:
      input.carbonSavingsVsNew !== undefined ? String(input.carbonSavingsVsNew) : null,
    circularityScore: input.circularityScore ?? null,
    reuseSuitability: input.reuseSuitability ?? [],
    handlingRequirements: input.handlingRequirements ?? null,
    hazardousSubstances: input.hazardousSubstances ?? [],
    customAttributes: input.customAttributes ?? {},
  };
}
