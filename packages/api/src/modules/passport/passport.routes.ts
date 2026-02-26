import type { FastifyInstance } from 'fastify';
import { CreatePassportSchema, UpdatePassportSchema, PassportQuerySchema } from '@trace/core';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  createPassport,
  getPassportById,
  listPassports,
  updatePassport,
  verifyPassport,
  getPassportHistory,
} from './passport.service.js';

export async function passportRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/passports ────────────────────────────────────────────────
  // Hub staff / admin creates a new material passport
  app.post(
    '/',
    { preHandler: [authenticate, authorize('hub_staff', 'hub_admin', 'platform_admin')] },
    async (request, reply) => {
      const input = CreatePassportSchema.parse(request.body);
      const { sub: userId, organisationId } = request.user;

      if (!organisationId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_ORGANISATION', message: 'User is not associated with an organisation' },
        });
      }

      const passport = await createPassport(input, userId, organisationId);
      return reply.status(201).send({ success: true, data: passport });
    },
  );

  // ── GET /api/v1/passports ─────────────────────────────────────────────────
  // List passports for the authenticated user's organisation
  app.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = PassportQuerySchema.parse(request.query);
      const { organisationId } = request.user;

      if (!organisationId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_ORGANISATION', message: 'User is not associated with an organisation' },
        });
      }

      const result = await listPassports(query, organisationId);
      return reply.send({ success: true, ...result });
    },
  );

  // ── GET /api/v1/passports/:id ─────────────────────────────────────────────
  // Public — anyone can view an active passport (drafts require org membership)
  app.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      // Optionally extract user if authenticated
      let requestingOrgId: string | undefined;
      try {
        await request.jwtVerify();
        requestingOrgId = request.user.organisationId;
      } catch {
        // unauthenticated — that's fine for public passports
      }

      const passport = await getPassportById(request.params.id, requestingOrgId);
      return reply.send({ success: true, data: passport });
    },
  );

  // ── PATCH /api/v1/passports/:id ───────────────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate, authorize('hub_staff', 'hub_admin', 'platform_admin')] },
    async (request, reply) => {
      const input = UpdatePassportSchema.parse(request.body);
      const { sub: userId, organisationId } = request.user;

      if (!organisationId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_ORGANISATION', message: 'User is not associated with an organisation' },
        });
      }

      const passport = await updatePassport(request.params.id, input, userId, organisationId);
      return reply.send({ success: true, data: passport });
    },
  );

  // ── GET /api/v1/passports/:id/verify ─────────────────────────────────────
  // Public — returns passport with blockchain verification status
  app.get<{ Params: { id: string } }>(
    '/:id/verify',
    async (request, reply) => {
      const passport = await verifyPassport(request.params.id);
      return reply.send({ success: true, data: passport });
    },
  );

  // ── GET /api/v1/passports/:id/history ────────────────────────────────────
  // EPCIS event history for a passport
  app.get<{ Params: { id: string } }>(
    '/:id/history',
    async (request, reply) => {
      const events = await getPassportHistory(request.params.id);
      return reply.send({ success: true, data: events });
    },
  );
}
