# TRACE — Workshop Sprint Plan
**Target:** June 8, 2026 live demo + group testing session
**Branch:** `staging` → `main`
**Status:** Phase 3 complete — Phase 4 (hardening) next

---

## Scope Summary

The platform is ~80-85% feature-complete. This sprint closes the remaining gaps required for a live workshop where attendees first watch a demo, then test the platform in groups. An in-app feedback form captures their input. VeChain testnet deployment is **not** live at the workshop — the blockchain plumbing is made production-ready but `MATERIAL_REGISTRY_ADDRESS` is left unset until a post-workshop go-live step.

---

## Phase 1 — Bug Fixes & Stabilisation ✅ COMPLETE
**Window:** May 29–30
**Completed:** May 29

### Critical bugs
- [x] **Bug 1 — `offerPencE` typo** — renamed to `offerPence` in `listing.schema.ts`, `api-client.ts`, `marketplace.service.ts`
- [x] **Bug 2 — QR code runs in test env** — wrapped QR generation + MinIO upload in `if (env.NODE_ENV !== 'test')` in `passport.service.ts`
- [x] **Bug 3 — Anchor worker silent failure** — now throws `Error` (not `return`) when `MATERIAL_REGISTRY_ADDRESS` is unset; BullMQ marks job failed
- [x] **Bug 4 — JWT expiry not checked client-side** — `getToken()` decodes JWT, checks `exp` claim, calls `clearSession()` if expired in `auth.ts`
- [x] **Bug 5 — No Next.js auth middleware** — `packages/web/src/middleware.ts` created; redirects unauthenticated requests from `/dashboard/*`, `/passports/*`, `/listings/*`, `/quality/*`, `/transactions/*`, `/admin/*` to `/login`. Session also written to `trace_auth` cookie so middleware can read it.

### Code quality fixes
- [x] **Bug 11 — `as any` casts** — replaced with `TransactionWithListing` typed alias and a proper array cast in `marketplace.service.ts`
- [x] **Bug 12 — `createdAt` type mismatch** — fixed `createdAt: string` → `createdAt: Date` in `packages/core/src/types/quality.ts`
- [x] **Bug 13 — Anchor worker starts in test env** — guarded `startAnchorWorker()` with `if (env.NODE_ENV !== 'test')` in `index.ts`
- [x] **Bug 14 — `MEILI_ENV` hardcoded** — parameterised via `${MEILI_ENV:-development}` in `docker-compose.yml`; production VPS `.env` must set `MEILI_ENV=production`
- [x] **Bonus — pre-existing web typecheck errors** — fixed `exactOptionalPropertyTypes` conflicts in `admin/access-requests/page.tsx` and `access-request/page.tsx`; removed unused `CardTitle` import in `quality/page.tsx`

### All packages typecheck clean
- [x] `@trace/core` ✅
- [x] `@trace/db` ✅
- [x] `@trace/api` ✅
- [x] `@trace/web` ✅

### Merge
- [ ] All CI checks pass on `staging`
- [ ] Open PR `staging` → `main` and merge

---

## Phase 2 — Core Feature Completion ✅ COMPLETE
**Window:** May 31 – June 2
**Completed:** May 29

### 2a. Marketplace SQL filtering
- [x] Replaced in-memory O(n) post-filter with Drizzle SQL `SELECT` + `innerJoin` on `listings` ↔ `material_passports` ↔ `organisations` with all filter conditions in `WHERE`
- [x] Fixed `total` count: second `COUNT(*)` query uses identical `WHERE` + `JOIN` so pagination is accurate
- [x] `carbonSavingsVsNew` sort now uses actual `materialPassports.carbonSavingsVsNew` column (not fallback)

### 2b. Image uploads for passports
- [x] Added `POST /api/v1/passports/:id/photos` route — accepts multipart (JPEG/PNG/WebP/HEIC), calls `uploadBuffer()`, appends URL to `conditionPhotos` JSONB array
- [x] `uploadPassportPhoto()` service function with org ownership check
- [x] `passports.uploadPhoto(id, file, token)` added to API client (uses `FormData` + `fetch`, bypasses JSON helper)
- [x] Photo gallery + "Add photo" upload button added to `packages/web/src/app/(dashboard)/passports/[id]/page.tsx`

### 2c. MinIO bucket startup initialisation
- [x] `ensureBucket()` called for both `MINIO_BUCKET_PASSPORTS` and `MINIO_BUCKET_REPORTS` in `buildApp()` in `packages/api/src/server.ts` (skipped in test env)

### 2d. Cascade deletes
- [x] `{ onDelete: 'cascade' }` added to FK refs on `passportEvents.passportId`, `listings.passportId`, `transactions.listingId`, `qualityReports.passportId`, `sensorReadings.passportId`
- [x] Migration `0002_cultured_overlord.sql` generated and ready to apply

### 2e. VeChain anchor worker — fee delegation + testnet-ready
- [x] Rewrote anchor worker to use proper VeChain SDK `Transaction.of()`, `signAsSender()` — replaces incorrect `ethers.Wallet.signTransaction` approach
- [x] Gas estimation via `thorClient.transactions.estimateGas()` with 20% buffer (replaces hardcoded 0)
- [x] VIP-191 fee delegation: when `FEE_DELEGATOR_URL` is set, POSTs unsigned tx to delegator, receives gas payer signature, concatenates sender + gas payer signatures (65 + 65 bytes), submits combined tx
- [x] Startup validation in `validateAnchorConfig()`: when `MATERIAL_REGISTRY_ADDRESS` is set, asserts `VECHAIN_NODE_URL` and `DEPLOYER_PRIVATE_KEY` are present
- [x] Hardhat `evmVersion` changed from `shanghai` → `paris` (VeChainThor-correct target)
- [x] Deploy script updated to deploy all 3 contracts (`MaterialRegistry`, `CircularMarketplace`, `QualityAssurance`) and write all addresses to `deployments.json`

### All packages typecheck clean
- [x] `@trace/core` ✅
- [x] `@trace/db` ✅
- [x] `@trace/api` ✅
- [x] `@trace/web` ✅

---

## Phase 3 — Workshop Infrastructure ✅ COMPLETE
**Window:** June 3–4
**Completed:** May 29

### 3a. In-app feedback form
- [x] `feedback_submissions` table added to `packages/db/drizzle/schema.ts` (`id`, `user_id` nullable FK, `rating` integer 1–5, `category` text, `message` text, `page_url` text, `created_at`)
- [x] Migration `0003_warm_cargill.sql` generated — run `pnpm --filter @trace/db migrate` on VPS
- [x] `packages/api/src/modules/feedback/` module created with `feedback.service.ts` and `feedback.routes.ts`
  - `POST /api/v1/feedback` — public; attaches `user_id` when valid JWT is present
  - `GET /api/v1/feedback` — admin only (`platform_admin`, `hub_admin`)
- [x] `FeedbackWidget` component (`packages/web/src/components/FeedbackWidget.tsx`) — floating "Feedback" button (bottom-right), modal with 5-star rating, category chips, message textarea, page URL captured automatically
- [x] `FeedbackWidget` rendered inside `DashboardLayout` — visible on every dashboard page
- [x] `feedback.submit()` and `feedback.list()` added to API client
- [x] `/admin/feedback` page with summary cards (avg rating, count by category) and full submission list — linked in nav for `platform_admin` and `hub_admin`

### 3b. Workshop demo data
- [x] Seed script reviewed — existing data is sufficient for demo:
  - **Org:** Stirling Reuse Hub (hub, verified)
  - **Users (5):** platform_admin, hub_admin, hub_staff, inspector, buyer — credentials printed on `pnpm seed`
  - **Passports (3):** Victorian Red Brick (active, grade B), Steel I-Beam (listed, grade A), Welsh Slate (draft, grade C) — covers all status/condition scenarios
- [ ] When Stirling material list arrives: extend `packages/db/scripts/seed.ts` with real entries
- [ ] Pre-seed workshop attendee accounts before June 7 and run `pnpm --filter @trace/db seed` on production VPS

### All packages typecheck clean
- [x] `@trace/core` ✅
- [x] `@trace/db` ✅
- [x] `@trace/api` ✅
- [x] `@trace/web` ✅

---

## Phase 4 — Production Hardening
**Window:** June 5–6
**Goal:** VPS verified, auto-deploy confirmed, staging E2E smoke test passed.

### 4z. Developer tooling (2026-06-02)
- [x] Vendored 5 VeChain AI skills into `.claude/skills/` (`vechain-core`, `smart-contract-development`, `thor`, `secure-github-actions`, `frontend`) — auto-load for all contributors + CI
- [x] Added `.claude/skills/README.md` (provenance + re-sync instructions)
- [x] Fixed stale `evmVersion: 'shanghai'` → `'paris'` in `CLAUDE.md` (matches Hardhat config)
- [x] Added a "VeChain AI Skills" pointer section to `CLAUDE.md`
- [x] **CI hardening** (per `secure-github-actions` skill): SHA-pinned all `uses:` actions in `ci.yml`, `deploy-staging.yml`, `deploy-production.yml` (with `# vX.Y.Z` comments); added least-privilege `permissions: contents: read` to all three; added `.github/dependabot.yml` (github-actions, weekly) to keep pins fresh

### 4a. GitHub Actions secrets (manual — outside codebase)
- [ ] Verify/add in GitHub → Settings → Secrets → Actions:
  - `TRACE_STAGING_SSH_HOST`
  - `TRACE_STAGING_SSH_USER`
  - `TRACE_STAGING_SSH_KEY`
  - `TRACE_PRODUCTION_SSH_HOST`
  - `TRACE_PRODUCTION_SSH_USER`
  - `TRACE_PRODUCTION_SSH_KEY`
- [ ] Test: push a trivial change to `staging` and confirm deploy completes in Actions tab

### 4b. VPS checklist (repeat for staging and production)
- [ ] `.env` present with strong `JWT_SECRET` (≥32 random chars)
- [ ] `DEPLOYER_PRIVATE_KEY` set
- [ ] `MATERIAL_REGISTRY_ADDRESS` intentionally **left unset** for the workshop
- [ ] `MEILI_ENV=production` set in production `.env`
- [ ] All containers running: `docker compose ps`
- [ ] Migrations applied: `docker compose run --rm api pnpm --filter @trace/db migrate`
- [ ] MinIO public URL reachable: verify a seeded passport's QR image loads in browser
- [ ] nginx routing active: `/api/*` → Fastify (3001), `/*` → Next.js (3000)

### 4c. E2E smoke test on staging
**API-level dry-run PASSED locally 2026-06-03** (source API against the dev DB/Redis/MinIO). All
8 stages green. Two checklist items had inaccurate wording — corrected below.
- [x] Register as buyer → submit access request
- [x] ~~Log in as hub admin~~ **Log in as platform_admin** → approve access request *(the
  `/access-requests/:id/approve` route is `authorize('platform_admin')` — hub_admin gets 403)*
- [x] Log in as hub staff → create passport + upload photo → confirm QR links to public page
      *(photo upload to MinIO + public `GET /passports/:id` + `/verify` all 200; QR & photo asset
      URLs resolve 200)*
- [x] Create listing for that passport
- [x] Log in as buyer → make offer
- [x] ~~hub staff accepts offer~~ **making an offer creates the transaction directly** (status
  `pending`); there is no separate seller-accept step. Buyer then drives lifecycle
  (`confirm_delivery` → `confirmed`, verified).
- [x] Log in as inspector → submit quality report
- [x] Use feedback button → submit entry → verify it appears in `/admin/feedback` *(verified:
  unauth submit accepted with `userId: null`, admin list returns it)*
- [x] Cascade delete verified: deleting a passport removes its listings, quality reports,
  passport events, and (via listing) transactions — migration `0002` working.

> **Repeat this on the actual staging VPS** before the workshop. The local dry-run used a
> source build; the VPS deploy rebuilds images (`up -d --build`), so it will pick up the same code.
> **Hard prerequisite:** migrations `0002`/`0003` must be applied on the VPS — see 4b. The local
> stack had them unapplied (so `feedback_submissions` was missing and the widget would have 500'd);
> applying them fixed it.

**Cosmetic (non-blocking):** public asset URLs contain a doubled segment
(`{MINIO_PUBLIC_URL}/passports/passports/<id>/qr.png`) — bucket `passports` + an object key that is
also prefixed `passports/`. URLs resolve `200`, so this is purely aesthetic; tidy post-workshop.

---

## Phase 5 — Final Buffer & Demo Prep
**Window:** June 7
**Goal:** Production smoke test done, attendees ready, facilitators briefed.

- [ ] Full E2E smoke test on production (`trace.adventurous.systems`)
- [ ] All workshop attendee accounts seeded on production VPS
- [ ] Demo script prepared (step-by-step scenario with seeded material data)
- [ ] Facilitators briefed on flows and login credentials
- [ ] WhatsApp community group ready to launch on workshop day
- [ ] `staging` confirmed live as fallback

---

## Post-Workshop: Enabling VeChain Testnet (Future Sprint)

Steps to flip blockchain anchoring live:
1. Fund deployer testnet wallet with VTHO
2. `pnpm --filter @trace/contracts deploy:testnet`
3. Copy deployed addresses from `deployments.json` into VPS `.env` (`MATERIAL_REGISTRY_ADDRESS` etc.)
4. Optionally configure `FEE_DELEGATOR_URL` — use [vechain.energy](https://vechain.energy) managed service (whitelist your `MATERIAL_REGISTRY_ADDRESS`, get a delegation URL back, zero infrastructure)
5. Push to `main` — GitHub Actions redeploys
6. Run one-off backfill job for existing unanchored passports

### Known Issues — must fix before testnet go-live (not blocking the workshop)

Anchoring stays off for the workshop (`MATERIAL_REGISTRY_ADDRESS` unset), so this does not
affect the June 8 demo. It must be resolved before flipping testnet live:

1. **Anchor worker — unsigned `tx.encoded` in the delegation path.** In
   `packages/api/src/workers/anchor-passport.worker.ts`, the VIP-191 branch builds the raw payload
   for the delegator from `tx.encoded` on an *unsigned* `Transaction.of(txBody)`. The VeChain SDK
   throws when `.encoded` is read before a signature exists. Validate the delegation flow against
   `.claude/skills/vechain-core/references/fee-delegation.md` and rework to the SDK's documented
   sender + gas-payer signing sequence. Exercise it against a real (or `vechain.energy`) delegator
   before go-live.

2. **~~CI workflow hardening~~ ✅ DONE 2026-06-02** — see Phase 4z. All `uses:` SHA-pinned,
   least-privilege `permissions:` added, Dependabot enabled.

---

## VeChain AI Skills — Now Vendored (from https://github.com/vechain/vechain-ai-skills)

First explored 2026-05-29; **vendored into the repo 2026-06-02**. The official `vechain-ai` plugin
(v0.3.0) ships **16 skills**. We copied the 5 relevant to TRACE into `.claude/skills/` so they
auto-load for every contributor and in CI — no per-machine install. See
[`.claude/skills/README.md`](../.claude/skills/README.md) for provenance and re-sync steps.

**Vendored:** `vechain-core`, `smart-contract-development`, `thor`, `secure-github-actions`,
`frontend`. (Skipped: wallet/Chakra `vechain-kit`, `create-vechain-dapp`, `vebetterdao`(+navigators),
`stargate`, `x-2-earn-apps`, `vechain-react-native-dev`, `translate`, `indexer-core`,
`auto-voting-relayers`, `grill-me` — none map to TRACE.)

Key technical findings applicable to this codebase:

### SDK Stack Validation
Our current stack (`@vechain/sdk-core` + `@vechain/sdk-network`) is correct. The repo confirms legacy packages (Connex, thor-devkit, web3-providers-connex) were deprecated Dec 31, 2024.

### Fee Delegation (VIP-191) — Phase 2e implementation pattern
From `skills/vechain-core/fee-delegation.md`:
```
1. Build transaction with reserved: { features: 1 }  ← enables delegation mode
2. POST unsigned tx to FEE_DELEGATOR_URL
3. Receive delegator signature
4. Combine sender signature + delegator signature
5. Submit combined signed transaction
```
Quick production option: **vechain.energy** managed sponsorship — whitelist a contract address, get a delegation URL, no infrastructure needed.

### EVM Version Correction ✅ RESOLVED
The VeChain AI skills repo specifies `paris` as the correct `evmVersion` for VeChainThor (Thor lacks the `PUSH0` opcode introduced in `shanghai`). Hardhat config was corrected to `paris` in Phase 2e; the stale `shanghai` reference in `CLAUDE.md` was also fixed on 2026-06-02. Both now agree.

### TypeChain Code Generation
`@vechain/sdk-hardhat-plugin` supports TypeChain codegen for type-safe contract bindings. This would replace the manual ABI string in `anchor-passport.worker.ts` and catch ABI mismatches at compile time.

### Multi-Clause Transactions (Future Optimisation)
VeChain supports atomic multi-clause transactions — all succeed or all fail, single gas fee. Post-workshop optimisation: batch multiple passport registrations in one transaction when the anchor queue has a backlog.

### UUPS Upgradeable Contracts (Future Consideration)
The smart-contract-development skill recommends deploying registries behind ERC1967 UUPS proxies for upgradeability. `MaterialRegistry.sol` currently is not upgradeable — worth considering before mainnet deployment.

---

## Out of Scope This Sprint

- VeChain testnet go-live
- CBT token / on-chain rewards
- Meilisearch full-text search
- Email notifications
- Email verification on signup
- Faceted marketplace filter UI (sliders)
- Dashboard charts
- Sensor data API routes
- Password change / user settings page
