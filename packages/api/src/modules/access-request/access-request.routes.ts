import type { FastifyInstance } from 'fastify';
import {
  AccessRequestQuerySchema,
  ApproveAccessRequestSchema,
  CreateAccessRequestSchema,
  RejectAccessRequestSchema,
  UpdateAccessRequestOrganisationSchema,
  UpdateApprovedUserAccessSchema,
  UpdatePendingAccessRequestSchema,
} from '@trace/core';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  approveAccessRequest,
  listAccessRequests,
  listAccessRequestOrganisations,
  listMyAccessRequests,
  rejectAccessRequest,
  submitAccessRequest,
  updateAccessRequestOrganisation,
  updateApprovedUserAccess,
  updatePendingAccessRequest,
} from './access-request.service.js';

export async function accessRequestRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const input = CreateAccessRequestSchema.parse(request.body);
      const created = await submitAccessRequest(
        request.user.sub,
        request.user.role,
        input,
      );

      return reply.status(201).send({
        success: true,
        data: created,
      });
    },
  );

  app.get(
    '/mine',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const data = await listMyAccessRequests(request.user.sub);
      return reply.send({
        success: true,
        data,
      });
    },
  );

  app.get(
    '/',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (request, reply) => {
      const query = AccessRequestQuerySchema.parse(request.query);
      const data = await listAccessRequests(query);
      return reply.send({
        success: true,
        data,
      });
    },
  );

  app.get(
    '/organisations',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (_request, reply) => {
      const data = await listAccessRequestOrganisations();
      return reply.send({
        success: true,
        data,
      });
    },
  );

  app.patch(
    '/organisations/:id',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (request, reply) => {
      const input = UpdateAccessRequestOrganisationSchema.parse(request.body);
      const params = request.params as { id: string };
      const data = await updateAccessRequestOrganisation(params.id, input);
      return reply.send({
        success: true,
        data,
      });
    },
  );

  app.patch(
    '/:id',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (request, reply) => {
      const input = UpdatePendingAccessRequestSchema.parse(request.body);
      const params = request.params as { id: string };
      const data = await updatePendingAccessRequest(params.id, input);
      return reply.send({
        success: true,
        data,
      });
    },
  );

  app.post(
    '/:id/approve',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (request, reply) => {
      const input = ApproveAccessRequestSchema.parse(request.body);
      const params = request.params as { id: string };
      const data = await approveAccessRequest(
        params.id,
        request.user.sub,
        input,
      );

      return reply.send({
        success: true,
        data,
      });
    },
  );

  app.patch(
    '/:id/approved-user',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (request, reply) => {
      const input = UpdateApprovedUserAccessSchema.parse(request.body);
      const params = request.params as { id: string };
      const data = await updateApprovedUserAccess(
        params.id,
        request.user.sub,
        input,
      );

      return reply.send({
        success: true,
        data,
      });
    },
  );

  app.post(
    '/:id/reject',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (request, reply) => {
      const input = RejectAccessRequestSchema.parse(request.body);
      const params = request.params as { id: string };
      const data = await rejectAccessRequest(
        params.id,
        request.user.sub,
        input,
      );

      return reply.send({
        success: true,
        data,
      });
    },
  );
}
