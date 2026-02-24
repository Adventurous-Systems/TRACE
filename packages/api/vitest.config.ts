import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    setupFiles: ['./src/test-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://trace:trace@localhost:5432/trace_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-secret-min-16-chars-long',
      JWT_EXPIRY: '1h',
      API_PORT: '3001',
      LOG_LEVEL: 'silent',
      WEB_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:3001',
    },
  },
});
