import { and, desc, eq } from 'drizzle-orm';
import { db, betaAccessRequests, organisations, users } from '@trace/db';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  type AccessRequestQueryInput,
  type ApproveAccessRequestInput,
  type CreateAccessRequestInput,
  type RejectAccessRequestInput,
} from '@trace/core';

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  organisationId: string | null;
} | null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organisationId: user.organisationId,
  };
}

function serializeAccessRequestWithRelations(request: {
  id: string;
  userId: string;
  requestedRole: string;
  organisationName: string | null;
  targetOrganisationId: string | null;
  notes: string | null;
  reviewNotes: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organisationId: string | null;
  } | null;
  targetOrganisation?: {
    id: string;
    name: string;
    type: string;
    slug: string;
    verified: boolean;
  } | null;
  reviewer?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organisationId: string | null;
  } | null;
}) {
  return {
    ...request,
    user: sanitizeUser(request.user ?? null),
    reviewer: sanitizeUser(request.reviewer ?? null),
  };
}

export async function submitAccessRequest(
  userId: string,
  userRole: string,
  input: CreateAccessRequestInput,
) {
  if (userRole !== 'buyer') {
    throw new ForbiddenError('Only buyer accounts can request elevated access');
  }

  const existingPending = await db.query.betaAccessRequests.findFirst({
    where: and(
      eq(betaAccessRequests.userId, userId),
      eq(betaAccessRequests.status, 'pending'),
    ),
  });

  if (existingPending) {
    throw new ConflictError('You already have a pending access request');
  }

  const [request] = await db
    .insert(betaAccessRequests)
    .values({
      userId,
      requestedRole: input.requestedRole,
      organisationName: input.organisationName,
      notes: input.notes ?? null,
    })
    .returning();

  return request!;
}

export async function listMyAccessRequests(userId: string) {
  return db.query.betaAccessRequests.findMany({
    where: eq(betaAccessRequests.userId, userId),
    orderBy: [desc(betaAccessRequests.createdAt)],
  });
}

export async function listAccessRequests(query: AccessRequestQueryInput) {
  const where = query.status
    ? eq(betaAccessRequests.status, query.status)
    : undefined;

  const requests = await db.query.betaAccessRequests.findMany({
    where,
    with: {
      user: true,
      targetOrganisation: true,
      reviewer: true,
    },
    orderBy: [desc(betaAccessRequests.createdAt)],
  });

  return requests.map(serializeAccessRequestWithRelations);
}

export async function listAccessRequestOrganisations() {
  return db.query.organisations.findMany({
    columns: {
      id: true,
      name: true,
      slug: true,
      type: true,
      verified: true,
    },
    orderBy: [organisations.name],
  });
}

export async function approveAccessRequest(
  requestId: string,
  reviewerId: string,
  input: ApproveAccessRequestInput,
) {
  const request = await db.query.betaAccessRequests.findFirst({
    where: eq(betaAccessRequests.id, requestId),
  });

  if (!request) {
    throw new NotFoundError('Access request', requestId);
  }

  if (request.status !== 'pending') {
    throw new ConflictError('Only pending access requests can be approved');
  }

  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, input.organisationId),
  });

  if (!organisation) {
    throw new NotFoundError('Organisation', input.organisationId);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        role: input.role,
        organisationId: input.organisationId,
      })
      .where(eq(users.id, request.userId));

    await tx
      .update(betaAccessRequests)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        targetOrganisationId: input.organisationId,
        reviewNotes: input.reviewNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(betaAccessRequests.id, requestId));
  });

  const updated = await db.query.betaAccessRequests.findFirst({
    where: eq(betaAccessRequests.id, requestId),
    with: {
      user: true,
      targetOrganisation: true,
      reviewer: true,
    },
  });
  return updated ? serializeAccessRequestWithRelations(updated) : null;
}

export async function rejectAccessRequest(
  requestId: string,
  reviewerId: string,
  input: RejectAccessRequestInput,
) {
  const request = await db.query.betaAccessRequests.findFirst({
    where: eq(betaAccessRequests.id, requestId),
  });

  if (!request) {
    throw new NotFoundError('Access request', requestId);
  }

  if (request.status !== 'pending') {
    throw new ConflictError('Only pending access requests can be rejected');
  }

  const [updated] = await db
    .update(betaAccessRequests)
    .set({
      status: 'rejected',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(betaAccessRequests.id, requestId))
    .returning();

  return updated!;
}
