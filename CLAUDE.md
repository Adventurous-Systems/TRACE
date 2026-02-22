# CLAUDE.md — TRACE Project Context

## What is this project?

[TRACE](https://trace.construction/) is a blockchain-enabled digital marketplace for construction material reuse hubs. It issues EU DPP-compliant material passports, anchors integrity proofs on VeChainThor, and governs the system through Ostrom commons principles via smart contracts.

**Read `SPEC.md` for the full specification.** This file covers conventions and quick-reference only.

---

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 9+, Docker

# Start infrastructure
docker compose up -d    # Thor Solo (8669), PostgreSQL (5432), Redis (6379), MinIO (9000), Meilisearch (7700)

# Install dependencies
pnpm install

# Run DB migrations
pnpm --filter @trace/db migrate

# Seed reference data (material categories, test hub, test users)
pnpm --filter @trace/db seed

# Start API dev server
pnpm --filter @trace/api dev     # http://localhost:3001

# Start web dev server
pnpm --filter @trace/web dev     # http://localhost:3000

# Deploy contracts to Thor Solo
pnpm --filter @trace/contracts deploy:solo

# Run all tests
pnpm test
```

---

## Monorepo Structure

```
packages/core/        → Shared types, Zod validators, constants, enums
packages/db/          → Drizzle ORM schema, migrations, seed data
packages/api/         → Fastify backend (modules: auth, passport, marketplace, blockchain, quality, governance, hub)
packages/web/         → Next.js 14 App Router frontend (PWA)
packages/contracts/   → Solidity smart contracts + Hardhat (VeChain plugin)
packages/sdk/         → TypeScript SDK for external consumers
```

Package naming: `@trace/core`, `@trace/db`, `@trace/api`, `@trace/web`, `@trace/contracts`, `@trace/sdk`.

---

## Coding Conventions

### TypeScript (all packages)

- **Strict mode** everywhere: `"strict": true` in tsconfig
- **No `any`** — use `unknown` and narrow, or define proper types
- **Imports:** Named imports, no default exports except React components and Next.js pages
- **Naming:**
  - Files: `kebab-case.ts` (e.g., `material-passport.ts`)
  - Types/Interfaces: `PascalCase` (e.g., `MaterialPassport`)
  - Functions/variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - DB columns: `snake_case`
  - API responses: `camelCase` (transformed from DB snake_case via Drizzle)
- **Error handling:** All async functions wrapped in try/catch. Use custom error classes from `@trace/core/errors`.
- **No console.log** in production code — use the logger from `@trace/core/logger` (pino)

### API (Fastify)

- **Module pattern:** Each feature is a Fastify plugin in `src/modules/{name}/`:
  ```
  modules/passport/
  ├── passport.routes.ts    # Route definitions with Zod schemas
  ├── passport.service.ts   # Business logic (no HTTP concerns)
  ├── passport.schema.ts    # Zod request/response schemas
  └── passport.test.ts      # Integration tests
  ```
- **Route schemas:** Define request body, params, querystring, and response with Zod. Fastify validates automatically.
- **Response envelope:** All API responses follow:
  ```json
  { "success": true, "data": { ... } }
  { "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
  ```
- **Auth middleware:** JWT token in `Authorization: Bearer <token>`. Decoded user attached to `request.user`.
- **Tenant isolation:** Middleware reads `organisation_id` from JWT and sets it on request context. All DB queries filter by it automatically via Drizzle.

### Frontend (Next.js)

- **App Router** with server components by default. Client components only when needed (`'use client'`).
- **Component naming:** `PascalCase` files for components (e.g., `PassportCard.tsx`)
- **Page structure:**
  ```
  app/(public)/              # Public routes (no auth)
  app/(auth)/                # Auth routes (login, register)
  app/(dashboard)/           # Authenticated routes
  app/(dashboard)/passport/  # Passport-related pages
  ```
- **Data fetching:** TanStack Query for client-side. Server components fetch directly via the API client.
- **Forms:** React Hook Form + Zod schemas imported from `@trace/core`.
- **Styling:** Tailwind utility classes. No custom CSS files. Use shadcn/ui components.
- **Mobile-first:** Always write mobile styles first, enhance with `md:` and `lg:` prefixes.

### Smart Contracts (Solidity)

- **Version:** `pragma solidity ^0.8.20;`
- **Hardhat config:** `evmVersion: 'shanghai'` (VeChainThor compatibility)
- **Plugin:** `@vechain/sdk-hardhat-plugin` for VeChain network connectivity
- **Testing:** Tests run against Thor Solo node (Docker). Use `npx hardhat test --network vechain_solo`.
- **Style:** Follow OpenZeppelin patterns. Use `AccessControl` for role management. Events for every state change.
- **Naming:** Contracts `PascalCase`. Functions `camelCase`. Events `PascalCase`. Constants `UPPER_SNAKE_CASE`.
- **Gas optimisation:** Batch hash anchoring. Use events over storage where possible. Keep structs tight.
- **Cross-contract calls:** Contracts reference each other by address stored in a `ContractRegistry` or via constructor injection.

### Database

- **ORM:** Drizzle ORM. Schema defined in `packages/db/drizzle/schema.ts`.
- **Migrations:** Generated via `drizzle-kit generate`. Applied via `drizzle-kit migrate`.
- **Naming:** Tables `snake_case` plural (e.g., `material_passports`). Columns `snake_case`.
- **IDs:** UUID v7 (`gen_random_uuid()`). Never auto-increment integers.
- **Timestamps:** Always `TIMESTAMPTZ`. Columns: `created_at`, `updated_at`.
- **Soft deletes:** No. Use status fields instead (`status: 'decommissioned'`).
- **JSONB:** Use for flexible/optional attributes (technical_specs, custom_attributes, branding). Structured data gets proper columns.

---

## Blockchain Integration Pattern

The API is the bridge between off-chain and on-chain. Users never interact with the blockchain directly.

```
User Action → API validates → DB write → Queue blockchain job → Worker anchors on-chain → DB updated with tx hash
```

**Key pattern for material registration:**
1. Hub staff submits material via form
2. API validates, stores in PostgreSQL, generates QR code
3. Background job: compute `keccak256(JSON-LD passport data)`
4. Submit to `MaterialRegistry.registerPassport()` via VeChain SDK
5. On tx confirmation: store `blockchain_tx_hash` and `blockchain_anchored_at` in DB
6. Passport is now verifiable: anyone can hash the JSON-LD and compare against on-chain record

**VeChain SDK usage:**
```typescript
import { ThorClient, HttpClient } from '@vechain/sdk-network';
import { Contract } from '@vechain/sdk-core';

const thorClient = new ThorClient(new HttpClient('http://localhost:8669'));
// Use thorClient for all blockchain reads/writes
```

**Fee delegation:** When sending transactions on behalf of users, use VeChain's fee delegation so the hub's VTHO covers gas costs:
```typescript
// The API server holds the hub's private key and delegates fees
const delegatorUrl = process.env.FEE_DELEGATOR_URL;
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://trace:trace@localhost:5432/trace

# Redis
REDIS_URL=redis://localhost:6379

# VeChain
VECHAIN_NODE_URL=http://localhost:8669        # Thor Solo for dev
DEPLOYER_PRIVATE_KEY=0x...                    # Contract deployer
FEE_DELEGATOR_URL=                            # Fee delegation service URL (optional)

# Contract addresses (populated after deploy)
MATERIAL_REGISTRY_ADDRESS=0x...
MARKETPLACE_ADDRESS=0x...
CBT_ADDRESS=0x...
QUALITY_ASSURANCE_ADDRESS=0x...
IOT_ORACLE_ADDRESS=0x...
GOVERNANCE_ADDRESS=0x...
HUB_REGISTRY_ADDRESS=0x...

# Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Search
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_KEY=masterKey

# Auth
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRY=7d

# App
API_PORT=3001
WEB_URL=http://localhost:3000
API_URL=http://localhost:3001
```

---

## Docker Compose Services

```yaml
services:
  thor-solo:
    image: vechain/thor:latest
    command: solo --on-demand --persist --api-cors '*' --api-addr 0.0.0.0:8669
    ports: ["8669:8669"]
    volumes: [thor-data:/home/thor]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: trace
      POSTGRES_USER: trace
      POSTGRES_PASSWORD: trace
    ports: ["5432:5432"]
    volumes: [pg-data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin

  meilisearch:
    image: getmeili/meilisearch:latest
    ports: ["7700:7700"]
    environment:
      MEILI_MASTER_KEY: masterKey
```

---

## Key Design Decisions

1. **VeChainThor over Base/Optimism:** Enterprise focus, fee delegation (users don't need crypto), multi-clause transactions (batch operations), sustainability positioning aligned with circular economy mission.

2. **Fastify over Express:** 2-3x faster, built-in schema validation, TypeScript-first plugin system.

3. **Drizzle over Prisma:** Lighter, SQL-first, no binary engine, better for JSONB and raw queries.

4. **Modular monolith:** Single deployable unit with clean module boundaries. Extractable to microservices later if needed. Ideal for Claude Code development.

5. **PWA over native apps:** Single codebase, no app store friction, instant updates. Camera and offline via browser APIs.

6. **UUID v7 over ULID/auto-increment:** Sortable by time, database-native generation, no external dependency.

7. **Material passport schema is universal:** Designed for ANY construction material (new or reclaimed). Circular economy metadata is an extension layer, not the core. This positions the platform for the broader EU DPP market.

---

## Common Tasks

### Add a new API endpoint
1. Define Zod schemas in `modules/{name}/{name}.schema.ts`
2. Write business logic in `modules/{name}/{name}.service.ts`
3. Register route in `modules/{name}/{name}.routes.ts`
4. Write integration test in `modules/{name}/{name}.test.ts`
5. Run `pnpm --filter @trace/api test`

### Add a new database table
1. Add table definition in `packages/db/drizzle/schema.ts`
2. Generate migration: `pnpm --filter @trace/db generate`
3. Apply migration: `pnpm --filter @trace/db migrate`
4. Add corresponding TypeScript types in `packages/core/src/types/`
5. Add Zod validators in `packages/core/src/validators/`

### Deploy a new smart contract
1. Write contract in `packages/contracts/contracts/`
2. Write tests in `packages/contracts/test/`
3. Run tests: `pnpm --filter @trace/contracts test`
4. Add to deploy script in `packages/contracts/scripts/deploy.ts`
5. Deploy to Solo: `pnpm --filter @trace/contracts deploy:solo`
6. Update `.env` with new contract address

### Add a new frontend page
1. Create page file in `packages/web/app/(dashboard)/{route}/page.tsx`
2. Use server components for data fetching where possible
3. Create client components in `packages/web/components/` only when interactivity needed
4. Use Zod schemas from `@trace/core` for form validation
5. Mobile-first: test at 375px before desktop

---

## Testing Commands

```bash
pnpm test                                    # All tests
pnpm --filter @trace/api test                # API unit + integration
pnpm --filter @trace/web test                # Frontend tests
pnpm --filter @trace/contracts test          # Smart contract tests (requires Thor Solo)
pnpm --filter @trace/core test               # Core validators/utils
pnpm e2e                                     # Playwright E2E (requires all services running)
```

---

## Current Sprint Focus

**Sprint 0 → S1: Foundation + Vertical Slice 1**

Goal: Register a material → anchor on VeChain → generate QR → scan QR → view passport.

Priority order:
1. Docker Compose with Thor Solo + PostgreSQL + Redis
2. Database schema + migrations (core tables only)
3. `MaterialRegistry.sol` deployed to Thor Solo
4. API: POST /api/v1/passports (create + blockchain anchor)
5. API: GET /api/v1/passports/:id (read with verification)
6. QR code generation on passport creation
7. Public passport view page (scan QR → see material data)
8. Basic auth (JWT, hub staff role)

Everything else can wait. Get this loop working first.
