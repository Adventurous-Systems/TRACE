import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // Server
  API_PORT: z.coerce.number().int().default(3001),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3001'),

  // Auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRY: z.string().default('7d'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // VeChain
  VECHAIN_NODE_URL: z.string().url().default('http://localhost:8669'),
  MATERIAL_REGISTRY_ADDRESS: z.string().optional(),
  MARKETPLACE_ADDRESS: z.string().optional(),
  CBT_ADDRESS: z.string().optional(),
  QUALITY_ASSURANCE_ADDRESS: z.string().optional(),
  IOT_ORACLE_ADDRESS: z.string().optional(),
  GOVERNANCE_ADDRESS: z.string().optional(),
  HUB_REGISTRY_ADDRESS: z.string().optional(),
  CONTRACT_REGISTRY_ADDRESS: z.string().optional(),
  FEE_DELEGATOR_URL: z.string().url().optional(),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET_PASSPORTS: z.string().default('passports'),
  MINIO_BUCKET_REPORTS: z.string().default('reports'),

  // Meilisearch
  MEILISEARCH_URL: z.string().url().default('http://localhost:7700'),
  MEILISEARCH_KEY: z.string().default('masterKey'),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
