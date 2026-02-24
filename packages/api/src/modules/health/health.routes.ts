import type { FastifyInstance } from 'fastify';
import { db } from '@trace/db';
import { sql } from 'drizzle-orm';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    let dbOk = false;

    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      // DB unreachable — return degraded state, do not throw
    }

    return reply.status(dbOk ? 200 : 503).send({
      success: dbOk,
      data: {
        status: dbOk ? 'ok' : 'degraded',
        db: dbOk,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
