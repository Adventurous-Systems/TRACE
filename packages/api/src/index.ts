import 'dotenv/config';
import { buildApp } from './server.js';
import { env } from './env.js';

async function main() {
  const app = await buildApp();

  await app.listen({
    port: env.API_PORT,
    host: '0.0.0.0',
  });
}

main().catch((err) => {
  process.stderr.write(`Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
