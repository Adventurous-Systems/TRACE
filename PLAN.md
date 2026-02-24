# TRACE — Build Plan

> Last updated: 2026-02-23
> Status: **Sprint 0 complete. Sprint 1 not started.** All foundation packages built and typechecking clean. Auth integration tests require Docker infrastructure.

---

## Repository State

| Asset | Status |
|-------|--------|
| `SPEC.md` | Complete |
| `CLAUDE.md` | Complete |
| `README.md` | Complete |
| `ecosystem_mapping.drawio` | Complete |
| `TRACE_Flow-Diagram_v0.2.drawio` | Complete |
| Monorepo scaffold | **COMPLETE** ✓ |
| Docker Compose stack | **COMPLETE** ✓ |
| `@trace/core` | **COMPLETE** ✓ |
| `@trace/db` | **COMPLETE** ✓ |
| `@trace/api` skeleton | **COMPLETE** ✓ |
| `@trace/web` scaffold | NOT STARTED |
| `@trace/contracts` | NOT STARTED |
| `@trace/sdk` | NOT STARTED (placeholder only) |

---

## Sprint Status

| Sprint | Duration | Status | Deliverable |
|--------|----------|--------|-------------|
| **S0** | 1 week | `COMPLETE` ✓ | Monorepo, Docker, core packages |
| **S1** | 2 weeks | `NOT STARTED` | Register material → anchor → QR → view passport |
<!-- S0 subtasks below for reference -->
| **S2** | 2 weeks | `NOT STARTED` | Marketplace: list, search, buy |
| **S3** | 2 weeks | `NOT STARTED` | Quality assurance + inspector workflow |
| **S4** | 2 weeks | `PLANNED` | UI polish + UAT 1 with Stirling Reuse Hub |
| **S5** | 2 weeks | `PLANNED` | CBT token deployment + staking + rewards |
| **S6** | 2 weeks | `PLANNED` | Multi-hub: tenant isolation, subdomain routing |
| **S7** | 2 weeks | `PLANNED` | Analytics dashboard + environmental metrics |
| **S8** | 2 weeks | `PLANNED` | Full escrow + dispute flow + UAT 2 |
| **S9** | 2 weeks | `PLANNED` | IoT: MQTT broker, sensor registration, oracle |
| **S10** | 2 weeks | `PLANNED` | Governance: proposals, voting, arbitration |
| **S11** | 2 weeks | `PLANNED` | Security audit, hardening, perf + UAT 3 |
| **S12** | 2 weeks | `PLANNED` | Mainnet deploy, documentation, launch |

---

## Critical Path

```
S0: Monorepo scaffold ──┬── @trace/core ──┬── @trace/api ──┬── Passport API ──┬── Public view
                        │                 │                 │                  └── Staff wizard
                        ├── @trace/db ────┘                 │
                        │                                   │
                        └── Docker Compose ── MaterialRegistry.sol ──┘

S0 must be complete before anything in S1 can be tested end-to-end.
```

---

## Sprint 0 — Foundation

**Goal:** Everything required for a developer to clone the repo, run `docker compose up`, and have a working API + DB.

### S0-1 — Monorepo Scaffolding
**Status:** `COMPLETE` ✓

- [ ] `pnpm-workspace.yaml` — `packages/*`
- [ ] Root `package.json` — scripts: `dev`, `build`, `test`, `lint`, `typecheck`
- [ ] `turbo.json` — Turborepo pipeline (build → test → lint, parallel dev)
- [ ] Root `tsconfig.json` — strict mode, path aliases for `@trace/*`
- [ ] `.nvmrc` — Node 20
- [ ] `.npmrc` — `prefer-workspace-packages=true`
- [ ] `.gitignore` — node_modules, dist, .env, .turbo
- [ ] ESLint config (flat config, TypeScript rules, import order)
- [ ] Prettier config
- [ ] Create 6 package directories with minimal `package.json`:
  - `packages/core/`
  - `packages/db/`
  - `packages/api/`
  - `packages/web/`
  - `packages/contracts/`
  - `packages/sdk/`

### S0-2 — Docker Compose Stack
**Status:** `COMPLETE` ✓

- [ ] `docker-compose.yml`:
  - `vechain/thor:latest` — solo mode, on-demand blocks, port 8669
  - `postgres:16-alpine` — user/pass/db = `trace`, port 5432
  - `redis:7-alpine` — port 6379
  - `minio/minio` — port 9000 (API), 9001 (console), credentials `minioadmin`
  - `getmeili/meilisearch:latest` — port 7700, master key `masterKey`
  - Named volumes for all stateful services
  - Health checks on all containers
- [ ] `.env.example` — all environment variables from `CLAUDE.md`
- [ ] `Makefile` or root `package.json` scripts: `docker:up`, `docker:down`, `docker:reset`, `docker:logs`

### S0-3 — `@trace/core` Package
**Status:** `COMPLETE` ✓

Shared types, validators, and constants used by every other package. No runtime dependencies on Node APIs — must be importable in both browser and server.

- [ ] `src/types/passport.ts` — `MaterialPassport`, `CircularExtension`, `PassportStatus` enum, `ConditionGrade`, `EPCISEvent`
- [ ] `src/types/user.ts` — `User`, `UserRole` enum (platform_admin, hub_admin, hub_staff, supplier, buyer, inspector)
- [ ] `src/types/listing.ts` — `Listing`, `Transaction`, `ListingStatus`, `TransactionStatus`
- [ ] `src/types/hub.ts` — `Organisation`, `OrganisationType`
- [ ] `src/validators/passport.schema.ts` — Zod: `CreatePassportSchema`, `UpdatePassportSchema`, `PassportResponseSchema`
- [ ] `src/validators/auth.schema.ts` — Zod: `LoginSchema`, `RegisterSchema`, `JwtPayloadSchema`
- [ ] `src/validators/listing.schema.ts` — Zod: `CreateListingSchema`, `MakeOfferSchema`
- [ ] `src/constants/categories.ts` — 10 L1 material categories with 80+ L2 subcategories (full taxonomy from `SPEC.md §5.3`)
- [ ] `src/constants/config.ts` — status enums, GS1 GTIN prefix for prototype, CBT reward amounts
- [ ] `src/errors.ts` — `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `BlockchainError`, `ConflictError`
- [ ] `src/logger.ts` — Pino logger factory (log level from env, JSON in prod, pretty in dev)
- [ ] `src/index.ts` — barrel export of everything
- [ ] Vitest config + basic validator unit tests

### S0-4 — `@trace/db` Package
**Status:** `COMPLETE` ✓

Drizzle ORM schema, migrations, and seed data.

- [ ] Install: `drizzle-orm`, `drizzle-kit`, `postgres`
- [ ] `drizzle/schema.ts` — full schema per `SPEC.md §6`:
  - `organisations` table
  - `users` table
  - `material_passports` table (all columns including blockchain anchoring fields)
  - `passport_events` table
  - `listings` table
  - `transactions` table
  - `quality_reports` table
  - `sensor_readings` table (partitioned by `created_at`)
  - All indexes from spec
- [ ] `drizzle.config.ts` — connection via `DATABASE_URL`
- [ ] Run `drizzle-kit generate` → first migration in `migrations/`
- [ ] `seed/categories.ts` — full 10 L1 + 80+ L2 category reference data
- [ ] `seed/index.ts` — seeds: categories, 1 test org (Stirling Reuse Hub), test hub_admin user, test hub_staff user, 3 sample passports
- [ ] `scripts/migrate.ts` — runs all pending migrations
- [ ] `scripts/seed.ts` — runs seed with idempotent upserts
- [ ] `package.json` scripts: `generate`, `migrate`, `seed`, `studio` (Drizzle Studio)
- [ ] Export: typed `db` instance, all table references, inferred insert/select types

### S0-5 — `@trace/api` Skeleton
**Status:** `COMPLETE` ✓

Fastify server with auth, middleware, and module structure in place.

- [ ] Install: `fastify`, `@fastify/jwt`, `@fastify/cors`, `@fastify/multipart`, `@fastify/rate-limit`, `pino`, `bcrypt`, `zod`
- [ ] `src/env.ts` — Zod-validated environment variables (fails fast on startup if missing)
- [ ] `src/server.ts` — register all plugins + modules, export `buildApp()` factory
- [ ] `src/middleware/auth.ts` — JWT decode hook, attach `request.user`, reject 401 on invalid token
- [ ] `src/middleware/tenant.ts` — extract `organisation_id` from JWT payload, attach to `request.context`
- [ ] `src/middleware/error-handler.ts` — map error classes to HTTP status codes, format `{success, error}` envelope
- [ ] `src/modules/health/` — `GET /health` returning `{status: 'ok', db: bool, redis: bool}`
- [ ] `src/modules/auth/` — `POST /api/v1/auth/login`, `POST /api/v1/auth/register` (bcrypt + JWT sign)
- [ ] Response envelope enforced on all routes: `{success: true, data}` / `{success: false, error: {code, message}}`
- [ ] Vitest + Supertest integration test setup
- [ ] `package.json` scripts: `dev` (tsx watch), `build` (tsc), `test`, `typecheck`

**Notes:**
- Fastify v5 requires `@fastify/cors@^10` and `@fastify/multipart@^9` (fixed from v9/v8)
- `LOG_LEVEL` enum extended to include `silent` for test suppression
- Vitest `env` config supplies test env vars before ESM module evaluation (avoids `setupFiles` race)
- Health tests pass standalone; auth tests are integration tests requiring PostgreSQL (Docker)
- Typecheck is clean across both `tsconfig.json` (dev) and `tsconfig.build.json` (prod)

---

## Sprint 1 — Vertical Slice 1

**Goal:** A hub staff member can register a material, it gets anchored on VeChainThor, a QR code is generated, and anyone can scan the QR to view the passport. Full loop end-to-end.

### S1-1 — `MaterialRegistry.sol` + Hardhat Config
**Status:** `NOT STARTED`

- [ ] Install: `hardhat`, `@vechain/sdk-hardhat-plugin`, `@openzeppelin/contracts`, `ethers`
- [ ] `hardhat.config.ts` — Solidity 0.8.20, evmVersion `shanghai`, networks: `vechain_solo`, `vechain_testnet`, `vechain_mainnet`
- [ ] `contracts/MaterialRegistry.sol` — full implementation:
  - `struct Material` — passportHash, registeredBy, currentHolder, status, timestamp, digitalLinkUri
  - `mapping(bytes32 => Material) public materials`
  - `mapping(address => bool) public authorisedHubs`
  - `AccessControl` — `HUB_ROLE`, `ADMIN_ROLE`
  - `registerPassport(bytes32 materialId, bytes32 passportHash, string calldata uri)`
  - `verifyIntegrity(bytes32 materialId, bytes32 expectedHash) view returns (bool)`
  - `transferOwnership(bytes32 materialId, address newHolder)`
  - `updateStatus(bytes32 materialId, MaterialStatus newStatus)`
  - `updateHash(bytes32 materialId, bytes32 newHash)` — for passport amendments
  - Events: `PassportRegistered`, `OwnershipTransferred`, `StatusUpdated`, `HashUpdated`
- [ ] `test/MaterialRegistry.test.ts` — 100% function coverage, runs against Thor Solo
- [ ] `scripts/deploy.ts` — deploy, log address, write to `.env`
- [ ] `package.json` scripts: `compile`, `test`, `deploy:solo`, `deploy:testnet`

### S1-2 — Passport API Module + Blockchain Anchoring
**Status:** `NOT STARTED`

The most complex task in S1. Touches DB, blockchain, file storage, and job queue.

- [ ] `src/modules/blockchain/vechain.client.ts` — `ThorClient` singleton, typed contract call helpers
- [ ] `src/modules/blockchain/blockchain.worker.ts` — BullMQ worker (Redis-backed):
  - Job: `anchor-passport` — receives passport ID
  - Computes `keccak256(JSON-LD passport data)`
  - Calls `MaterialRegistry.registerPassport()` via VeChain SDK
  - Polls for tx confirmation (VeChain finality: ~10s on solo, ~30s on mainnet)
  - On confirmation: updates `blockchain_tx_hash`, `blockchain_passport_hash`, `blockchain_anchored_at`
  - On failure: retries with exponential backoff (max 3 attempts), marks status `anchor_failed`
- [ ] `src/modules/passport/passport.schema.ts` — Zod: `CreatePassportInput`, `UpdatePassportInput`, `PassportResponse`
- [ ] `src/modules/passport/passport.service.ts`:
  - `createPassport(input, userId, orgId)` — validate, generate UUID v7, generate GS1 GTIN, insert to DB, enqueue anchor job, generate QR code, upload to MinIO
  - `getPassport(id, role)` — tiered response (public/professional/admin fields)
  - `updatePassport(id, input, userId)` — update DB, re-enqueue anchor job (hash changes)
  - `verifyPassport(id)` — fetch DB hash, compare vs on-chain via `verifyIntegrity()`
  - `uploadPhotos(id, files)` — upload to MinIO, update `condition_photos` array
  - `listPassports(orgId, filters)` — paginated, filtered
- [ ] `src/modules/passport/passport.routes.ts`:
  - `POST /api/v1/passports` — hub_staff+
  - `GET /api/v1/passports` — hub_staff+ (own org)
  - `GET /api/v1/passports/:id` — tiered public access
  - `PATCH /api/v1/passports/:id` — hub_staff+
  - `GET /api/v1/passports/:id/verify` — public
  - `POST /api/v1/passports/:id/photos` — hub_staff+ (multipart)
  - `GET /api/v1/passports/:id/events` — professional+
- [ ] `src/modules/passport/passport.test.ts` — integration tests for all routes
- [ ] QR code generation: `qrcode` library, GS1 Digital Link URI format `/resolve/01/{gtin}/21/{serial}`, PNG upload to MinIO, URL stored in `qr_code_url`

### S1-3 — `@trace/web` Scaffold
**Status:** `NOT STARTED`

- [ ] Next.js 14 App Router, TypeScript strict, `src/` directory
- [ ] Tailwind CSS — `tailwind.config.ts` with TRACE colour palette (greens, earth tones)
- [ ] shadcn/ui init — install: button, card, input, form, badge, dialog, select, tabs, skeleton, toast, avatar, dropdown-menu
- [ ] `next.config.js` — PWA via `next-pwa`, environment variable exposure, image domains (MinIO)
- [ ] `app/layout.tsx` — root: Inter font, metadata, providers wrapper
- [ ] `app/(public)/layout.tsx` — nav bar with logo + marketplace link + scan QR
- [ ] `app/(auth)/layout.tsx` — centred card layout
- [ ] `app/(auth)/login/page.tsx` — login form (React Hook Form + Zod)
- [ ] `app/(auth)/register/page.tsx` — register form
- [ ] `app/(dashboard)/layout.tsx` — sidebar nav: Dashboard, Register Material, Inventory, Listings, Orders
- [ ] `lib/api-client.ts` — typed fetch wrapper, auth header injection, error normalisation
- [ ] `lib/auth.ts` — JWT storage (httpOnly cookie via API), session management
- [ ] `middleware.ts` — route protection, redirect unauthenticated users
- [ ] TanStack Query provider in root layout
- [ ] `public/manifest.json` — PWA manifest (name, icons, theme colour, display: standalone)
- [ ] Service worker — cache: QR scanner page, passport view, inventory list

### S1-4 — Public Passport View + QR Scanner
**Status:** `NOT STARTED`

The public-facing side. Anyone who scans a QR code lands here.

- [ ] `app/(public)/passport/[id]/page.tsx` — server component, fetches `GET /api/v1/passports/:id`
  - `PassportHero` — product name, category badge, condition grade (A/B/C/D with colour), hub name
  - `PassportAttributes` — dimensions table, material composition, technical specs accordion
  - `BlockchainVerification` — anchoring status chip, tx hash (link to VeChain explorer), anchored timestamp, "Verify Now" button → calls `/verify` → shows match/mismatch
  - `CircularMetrics` — carbon savings vs new, circularity score (0–100 ring chart), reuse count
  - `EventTimeline` — EPCIS events (registered, inspected, listed, sold, installed) with dates
  - `PhotoGallery` — condition photos from MinIO
  - Loading skeleton, error state, not-found state
- [ ] `app/(public)/scan/page.tsx` — `'use client'`, html5-qrcode integration, camera permission request, redirect on successful decode
- [ ] `app/(public)/resolve/[...slug]/page.tsx` — GS1 Digital Link resolver (`/resolve/01/{gtin}/21/{serial}` → lookup passport → redirect to `/passport/:id`)
- [ ] Share metadata: `generateMetadata()` per page — og:title, og:description, og:image (material photo)

### S1-5 — Hub Staff Registration Wizard + Inventory
**Status:** `NOT STARTED`

- [ ] `app/(dashboard)/register/page.tsx` — multi-step wizard (React Hook Form with step validation):
  - Step 1: Material basics — product name, category L1 → L2 cascade dropdown, manufacturer name, country of origin
  - Step 2: Physical details — dimensions (L×W×H + weight + unit), condition grade selector, condition notes
  - Step 3: Circular provenance — previous building, deconstruction date + method, remaining life estimate
  - Step 4: Environmental data — GWP total (kgCO2e), recycled content (%), EPD reference URL
  - Step 5: Photos — drag-drop / camera capture, min 1 required
  - Step 6: Review — summary of all fields before submit
  - Auto-save to localStorage between steps (restore on refresh)
  - Progress bar showing current step
- [ ] On submit: `POST /api/v1/passports` → success screen shows QR code image + download button + "Register Another" + "View Passport"
- [ ] `app/(dashboard)/inventory/page.tsx`:
  - Table: photo thumbnail, name, category, condition grade, status badge, anchoring status (pending/anchored/failed), date, actions
  - Filters: status, category, condition grade, search by name
  - Pagination
  - Row click → passport detail
  - "Register Material" CTA button → wizard
- [ ] `app/(dashboard)/page.tsx` — dashboard home:
  - Stats: total materials, anchored, listed, sold this month
  - Recent registrations feed
  - Blockchain anchoring queue status (X pending, last anchored N minutes ago)

---

## Sprint 2 — Marketplace

**Goal:** Hub staff can list a material for sale. Buyers can search, discover, and make an offer.

### S2-1 — Remaining 6 Smart Contracts
**Status:** `NOT STARTED`

- [ ] `contracts/CircularMarketplace.sol` — `createListing`, `placeOffer`, `confirmDelivery`, `releaseFunds`, `flagDispute`, escrow held in contract, 48hr dispute window, fee split (hub 90% / platform 10%)
- [ ] `contracts/CircularBuildToken.sol` — ERC-20, `MINTER_ROLE`, `mint`, `stakeForQuality`, `slashStake`, staking positions mapped by materialId
- [ ] `contracts/QualityAssurance.sol` — `submitReport`, `disputeReport`, `updateInspectorReputation`, report hashes mapped to materialId
- [ ] `contracts/IoTOracle.sol` — `registerDevice`, `submitReading` (hash only), `verifyReading`, device whitelist
- [ ] `contracts/TraceGovernance.sol` — `createProposal`, `castVote`, `executeProposal`, `arbitrateDispute`, CBT-weighted voting, quorum threshold
- [ ] `contracts/HubRegistry.sol` — `registerHub`, `verifyHub`, `suspendHub`, `incrementMaterialCount`, inter-hub protocols
- [ ] `contracts/ContractRegistry.sol` — central address book for cross-contract lookups; all contracts call this on deployment
- [ ] Full Hardhat test suites for each contract (runs against Thor Solo)
- [ ] Multi-clause demo script: `registerPassport + mintCBT + incrementMaterialCount` in one atomic VeChain tx
- [ ] Updated `scripts/deploy.ts` — deploys all 7 contracts in correct order, wires addresses via ContractRegistry, writes all addresses to `.env`

### S2-2 — Marketplace API Module
**Status:** `NOT STARTED`

- [ ] Meilisearch index setup for `material_passports`:
  - Searchable: product_name, category_l1, category_l2, condition_notes, manufacturer_name
  - Filterable: status, category_l1, category_l2, condition_grade, organisation_id
  - Sortable: created_at, price_pence, carbon_savings_vs_new
  - Sync worker: updates Meilisearch on every passport create/update
- [ ] `src/modules/marketplace/marketplace.routes.ts`:
  - `GET /api/v1/marketplace/listings` — public: search (q), filter (category, condition, price range, location radius), paginated
  - `POST /api/v1/marketplace/listings` — hub_staff+: create listing, anchor on `CircularMarketplace.sol`
  - `PATCH /api/v1/marketplace/listings/:id` — hub_staff+: update price, expiry, cancel
  - `POST /api/v1/marketplace/offers` — buyer+: place offer (creates transaction, triggers escrow)
  - `PATCH /api/v1/marketplace/transactions/:id` — confirm delivery / flag dispute
  - `GET /api/v1/hubs` — public: hub directory with material counts, location
  - `GET /api/v1/hubs/:id/inventory` — hub_staff+: paginated inventory for own hub
  - `GET /api/v1/hubs/:id/analytics` — hub_admin+: metrics
- [ ] On-chain event listener (VeChain event subscriptions) — sync `ListingCreated`, `OfferAccepted`, `DeliveryConfirmed`, `DisputeRaised` back to PostgreSQL
- [ ] `marketplace.service.ts`, `marketplace.schema.ts`, `marketplace.test.ts`

### S2-3 — Marketplace Frontend
**Status:** `NOT STARTED`

- [ ] `app/(public)/marketplace/page.tsx` — browse page:
  - Search bar (debounced, full-text via Meilisearch)
  - Filters sidebar: category tree, condition grade (A–D), price range slider, location (nearest hub radius), carbon savings toggle
  - Material card grid / list toggle
  - `MaterialCard` — photo, name, category badge, condition grade, price (GBP), carbon savings (kgCO2e vs new), hub name + distance
  - URL-persisted filter state (shareable links)
  - Infinite scroll pagination
- [ ] `app/(public)/marketplace/[listingId]/page.tsx` — listing detail:
  - Full photo gallery (swipeable)
  - Material specs + condition notes
  - Blockchain verification strip
  - Carbon savings callout
  - "Make Offer" button (opens modal, requires login)
  - Related listings (same category, same hub)
- [ ] `app/(dashboard)/listings/page.tsx` — hub staff: manage own listings, status badges, quick-edit price, delist
- [ ] `app/(dashboard)/orders/page.tsx` — orders for hub (incoming) and buyer (outgoing), confirm delivery CTA, dispute CTA
- [ ] `app/(public)/hubs/page.tsx` — hub directory with Leaflet map, hub cards (name, location, material count, specialties)

---

## Sprint 3 — Quality Assurance

**Goal:** A certified inspector can submit a quality report, it gets anchored on-chain, and it's visible on the passport with reputation tracking.

### S3 — Quality Module
**Status:** `NOT STARTED`

- [ ] `src/modules/quality/quality.routes.ts`:
  - `POST /api/v1/quality/reports` — inspector role: submit report
  - `GET /api/v1/quality/reports/:passportId` — professional+: all reports for a passport
  - `POST /api/v1/quality/reports/:id/dispute` — hub_staff+: flag report as inaccurate
- [ ] `quality.service.ts`:
  - `submitReport()` — validate scores (1–10 structural/aesthetic/environmental), compute overall_grade (A/B/C/D), insert to DB, update passport `condition_grade`, enqueue anchor job on `QualityAssurance.sol`, mint CBT reward for inspector
  - `getReports(passportId)` — returns reports with inspector public profile (name, reputation score, total reports)
  - `disputeReport()` — marks disputed, triggers governance arbitration queue
  - `updateInspectorReputation()` — recalculate after dispute resolution
- [ ] `quality.test.ts`
- [ ] `components/InspectionForm.tsx` (dashboard) — score sliders, overall grade selector, photo upload, notes, submit
- [ ] `components/PassportQualitySection.tsx` (public passport view) — list reports with scores, inspector name + reputation badge, dispute button for hub_staff

---

## Sprints 4–12 — Planned (Expand Per Sprint)

### S4 — UI Polish + UAT 1 *(Planned)*
- Refine material registration wizard based on Stirling Reuse Hub feedback
- Mobile viewport QA at 375px — every screen
- Accessibility audit (axe-core), WCAG 2.1 AA fixes
- Onboarding tour for new hub staff
- Email notifications (registration confirmation, offer received, order update)
- **UAT 1 with Stirling Reuse Hub**

### S5 — CBT Token + Staking *(Planned)*
- CBT reward dashboard (earnings, staking positions, leaderboard)
- Stake CBT as quality guarantee when listing a material
- Slash mechanic visible to buyers (shows seller has skin in the game)
- CBT balance displayed in dashboard header

### S6 — Multi-Hub Architecture *(Planned)*
- PostgreSQL Row Level Security — enforce `organisation_id` isolation at DB level
- Subdomain routing: `stirling.trace.eco`, `edinburgh.trace.eco`
- Hub onboarding wizard (hub admin self-service: name, logo, location, staff invites)
- Inter-hub material browsing (marketplace shows all hubs by default, filterable)
- Hub-level branding (logo, colour scheme pulled from `organisations.branding` JSONB)

### S7 — Analytics *(Planned)*
- Hub admin analytics dashboard:
  - Sankey diagram: materials received → assessed → listed → sold → installed
  - Carbon savings over time (cumulative kgCO2e)
  - Revenue chart (GBP), average transaction value
  - Circularity score distribution
- Platform-level metrics (admin only): all hubs, total materials, total transactions
- CSV + PDF export
- Environmental impact report generator (one-click PDF for grant reporting)

### S8 — Full Escrow + Dispute Flow + UAT 2 *(Planned)*
- On-chain escrow: VET held in `CircularMarketplace.sol` until delivery confirmed
- 48-hour dispute window after delivery confirmation
- Dispute arbitration: governance vote by CBT holders
- Dispute timeline UI with evidence submission
- Automated fund release on dispute resolution
- **UAT 2 with Stirling Reuse Hub**

### S9 — IoT Integration *(Planned)*
- MQTT broker (Mosquitto via Docker) for sensor data ingestion
- `IoTOracle.sol` device registration (whitelist management)
- Sensor types: humidity, temperature, structural load, accelerometer
- Sensor readings hashed and anchored on-chain
- `sensor_readings` table (time-series, partitioned by month)
- Live sensor dashboard on passport view (for materials still in storage)
- Simulated data generator for demo (Python script or Node)

### S10 — Governance *(Planned)*
- Proposal creation: any CBT holder above threshold can propose
- Proposal types: update quality standards, change fee structure, add inspector, resolve dispute
- Voting: CBT-weighted, 7-day window, quorum 10% of circulating supply
- `app/(dashboard)/governance/page.tsx` — proposal list, voting UI, results
- Dispute arbitration integrated with governance voting

### S11 — Security + Hardening + UAT 3 *(Planned)*
- Smart contract audit (Slither static analysis, manual review)
- API security: rate limiting per route, input sanitisation audit, SQL injection review
- OWASP top 10 review
- Dependency audit (`pnpm audit`)
- Load testing (k6): 100 concurrent users, passport creation, marketplace search
- VeChain testnet deployment + end-to-end smoke tests
- Error monitoring (Sentry) integration
- Structured logging review (no PII in logs)
- **UAT 3 with Stirling Reuse Hub** — full journey including marketplace + governance

### S12 — Mainnet Launch *(Planned)*
- VeChainThor mainnet deployment
- Managed PostgreSQL (Railway/Supabase)
- Cloudflare for DNS, CDN, DDoS protection
- CI/CD pipeline (GitHub Actions): lint → typecheck → test → build → deploy
- Monitoring: Uptime + Sentry + VeChain tx monitoring
- Documentation: API reference (auto-generated from Zod schemas), hub onboarding guide, inspector handbook
- Training materials for Stirling Reuse Hub staff
- Press + dissemination via BE-ST and Zero Waste Scotland

---

## Decisions to Lock Before Coding

These architectural decisions affect multiple sprints. Resolve before S0 starts:

| Decision | Options | Recommendation |
|----------|---------|---------------|
| **Fee delegation** | Self-hosted VTHO sponsor vs third-party service | Self-host for dev (env var `FEE_DELEGATOR_URL`), evaluate third-party before testnet |
| **Background jobs** | BullMQ (Redis) vs pg-boss (PostgreSQL) | BullMQ — Redis already in stack, mature, good dashboard |
| **GS1 GTIN format** | Real GTINs (need GS1 licence) vs prototype prefix `0000000` | Use `0000000` prefix for prototype, real GTINs for pilot |
| **Staging environment** | Railway vs Fly.io vs Render | Railway — simplest PostgreSQL + Redis managed, no DevOps overhead |
| **Payment currency** | VET (on-chain) vs GBP (off-chain Stripe) | Off-chain GBP for pilot; on-chain VET for later phase |
| **Email provider** | Resend vs Postmark vs SES | Resend — best developer experience, free tier adequate for pilot |

---

## Package Dependency Graph

```
@trace/core          (no internal deps — pure TS/Zod)
    ↑
@trace/db            (depends on: @trace/core)
    ↑
@trace/api           (depends on: @trace/core, @trace/db)
    ↑
@trace/sdk           (depends on: @trace/core — wraps API for external consumers)

@trace/web           (depends on: @trace/core — shares Zod schemas for forms)

@trace/contracts     (no internal deps — pure Solidity + Hardhat)
```

---

## Testing Strategy Summary

| Layer | Framework | Target | Runs Against |
|-------|-----------|--------|-------------|
| Core validators | Vitest | 100% of validators | In-process |
| API integration | Vitest + Supertest | All routes, all error paths | Real PostgreSQL (Docker) |
| Smart contracts | Hardhat + Chai | 100% function coverage | Thor Solo (Docker) |
| Frontend | Vitest + Testing Library | Component logic, hooks | jsdom |
| E2E | Playwright | 5 critical journeys | Full stack (all Docker services) |
| Accessibility | axe-core + Playwright | Every public page | Full stack |
| Load | k6 | 100 concurrent users | Staging |

**5 Critical E2E journeys:**
1. Hub staff registers material → QR generated → public scans QR → views passport
2. Buyer searches marketplace → views listing → makes offer → seller accepts → delivery confirmed
3. Inspector submits quality report → visible on passport → CBT reward minted
4. CBT holder creates governance proposal → other holders vote → proposal executed
5. Hub admin onboards new hub → invites staff → staff registers first material

---

## Environment Variable Checklist

Before running anything, ensure `.env` has:

```
# From docker-compose
DATABASE_URL=postgresql://trace:trace@localhost:5432/trace
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_KEY=masterKey
VECHAIN_NODE_URL=http://localhost:8669

# After pnpm --filter @trace/contracts deploy:solo
MATERIAL_REGISTRY_ADDRESS=0x...
MARKETPLACE_ADDRESS=0x...
CBT_ADDRESS=0x...
QUALITY_ASSURANCE_ADDRESS=0x...
IOT_ORACLE_ADDRESS=0x...
GOVERNANCE_ADDRESS=0x...
HUB_REGISTRY_ADDRESS=0x...
CONTRACT_REGISTRY_ADDRESS=0x...

# Generate these
DEPLOYER_PRIVATE_KEY=0x...   # VeChain wallet with VTHO for contract deployment
JWT_SECRET=...               # 32+ random bytes
JWT_EXPIRY=7d

# App URLs
API_PORT=3001
WEB_URL=http://localhost:3000
API_URL=http://localhost:3001
```
