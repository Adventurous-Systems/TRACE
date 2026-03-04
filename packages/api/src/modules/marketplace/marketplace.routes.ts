import type { FastifyInstance } from 'fastify';
import {
  CreateListingSchema,
  UpdateListingSchema,
  MakeOfferSchema,
  MarketplaceQuerySchema,
  UpdateTransactionSchema,
} from '@trace/core';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  createListing,
  getListingById,
  searchListings,
  listHubListings,
  updateListing,
  cancelListing,
  makeOffer,
  updateTransaction,
  getTransactionById,
  listUserTransactions,
} from './marketplace.service.js';

export async function marketplaceRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/marketplace/listings ─────────────────────────────────────
  // Public: search/browse all active listings
  app.get(
    '/listings',
    async (request, reply) => {
      const query = MarketplaceQuerySchema.parse(request.query);
      const result = await searchListings(query);
      return reply.send({ success: true, data: result });
    },
  );

  // ── POST /api/v1/marketplace/listings ─────────────────────────────────────
  // Hub staff/admin: create a listing for a passport
  app.post(
    '/listings',
    { preHandler: [authenticate, authorize('hub_staff', 'hub_admin', 'platform_admin')] },
    async (request, reply) => {
      const input = CreateListingSchema.parse(request.body);
      const { sub: userId, organisationId } = request.user;

      if (!organisationId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_ORGANISATION', message: 'User is not associated with an organisation' },
        });
      }

      const listing = await createListing(input, userId, organisationId);
      return reply.status(201).send({ success: true, data: listing });
    },
  );

  // ── GET /api/v1/marketplace/listings/hub ──────────────────────────────────
  // Hub staff: view own hub's listings (all statuses)
  app.get(
    '/listings/hub',
    { preHandler: [authenticate, authorize('hub_staff', 'hub_admin', 'platform_admin')] },
    async (request, reply) => {
      const { organisationId } = request.user;

      if (!organisationId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_ORGANISATION', message: 'User is not associated with an organisation' },
        });
      }

      const data = await listHubListings(organisationId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /api/v1/marketplace/listings/:id ──────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/listings/:id',
    async (request, reply) => {
      const listing = await getListingById(request.params.id);
      return reply.send({ success: true, data: listing });
    },
  );

  // ── PATCH /api/v1/marketplace/listings/:id ────────────────────────────────
  // Hub staff: update price/quantity/shipping, or cancel
  app.patch<{ Params: { id: string } }>(
    '/listings/:id',
    { preHandler: [authenticate, authorize('hub_staff', 'hub_admin', 'platform_admin')] },
    async (request, reply) => {
      const { organisationId } = request.user;

      if (!organisationId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_ORGANISATION', message: 'User is not associated with an organisation' },
        });
      }

      // Check if this is a cancel action
      const body = request.body as Record<string, unknown>;
      if (body['action'] === 'cancel') {
        const listing = await cancelListing(request.params.id, organisationId);
        return reply.send({ success: true, data: listing });
      }

      const input = UpdateListingSchema.parse(request.body);
      const listing = await updateListing(request.params.id, input, organisationId);
      return reply.send({ success: true, data: listing });
    },
  );

  // ── POST /api/v1/marketplace/offers ───────────────────────────────────────
  // Buyer: make an offer on a listing (creates a transaction)
  app.post(
    '/offers',
    { preHandler: [authenticate, authorize('buyer', 'hub_staff', 'hub_admin', 'platform_admin')] },
    async (request, reply) => {
      const input = MakeOfferSchema.parse(request.body);
      const { sub: buyerId } = request.user;

      const tx = await makeOffer(input, buyerId);
      return reply.status(201).send({ success: true, data: tx });
    },
  );

  // ── GET /api/v1/marketplace/transactions ──────────────────────────────────
  // Authenticated: list own transactions (as buyer or seller)
  app.get(
    '/transactions',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.user;
      const data = await listUserTransactions(userId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /api/v1/marketplace/transactions/:id ──────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/transactions/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const tx = await getTransactionById(request.params.id);
      return reply.send({ success: true, data: tx });
    },
  );

  // ── PATCH /api/v1/marketplace/transactions/:id ────────────────────────────
  // Buyer/seller: confirm_delivery | flag_dispute | resolve_dispute | cancel
  app.patch<{ Params: { id: string } }>(
    '/transactions/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const input = UpdateTransactionSchema.parse(request.body);
      const { sub: userId } = request.user;

      const tx = await updateTransaction(request.params.id, input, userId);
      return reply.send({ success: true, data: tx });
    },
  );
}
