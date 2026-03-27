import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  getCbtBalance,
  getCbtTotalSupply,
  mintCbt,
  CBT_REWARDS,
  type MintReason,
} from './tokens.service.js';

const MintBodySchema = z.object({
  toAddress: z.string().min(42).max(42),
  amountCbt: z.number().positive(),
  reason: z.enum(['PASSPORT_REGISTRATION', 'QUALITY_REPORT', 'MARKETPLACE_SALE', 'ADMIN_GRANT']),
});

export async function tokenRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/tokens/balance/:address ───────────────────────────────────
  // Public: get CBT balance for any VeChain address
  app.get<{ Params: { address: string } }>(
    '/balance/:address',
    async (request, reply) => {
      const balance = await getCbtBalance(request.params.address);
      return reply.send({ success: true, data: { address: request.params.address, balance } });
    },
  );

  // ── GET /api/v1/tokens/me ─────────────────────────────────────────────────
  // Authenticated: get CBT balance for the calling user's blockchain address
  app.get(
    '/me',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { blockchainAddress } = request.user as { blockchainAddress?: string } & typeof request.user;
      if (!blockchainAddress) {
        return reply.send({ success: true, data: { balance: '0', address: null } });
      }
      const balance = await getCbtBalance(blockchainAddress);
      return reply.send({ success: true, data: { address: blockchainAddress, balance } });
    },
  );

  // ── GET /api/v1/tokens/stats ──────────────────────────────────────────────
  // Public: CBT supply stats and reward rates
  app.get('/stats', async (_request, reply) => {
    const totalSupply = await getCbtTotalSupply();
    return reply.send({
      success: true,
      data: {
        totalSupply,
        rewards: CBT_REWARDS,
        symbol: 'CBT',
        name: 'CircularBuildToken',
        decimals: 18,
      },
    });
  });

  // ── POST /api/v1/tokens/mint ──────────────────────────────────────────────
  // Platform admin only: manually mint CBT (dev/testing or admin grants)
  app.post(
    '/mint',
    { preHandler: [authenticate, authorize('platform_admin')] },
    async (request, reply) => {
      const input = MintBodySchema.parse(request.body);
      const txId = await mintCbt(input.toAddress, input.amountCbt, input.reason as MintReason);
      return reply.status(201).send({
        success: true,
        data: { txId, toAddress: input.toAddress, amountCbt: input.amountCbt, reason: input.reason },
      });
    },
  );
}
