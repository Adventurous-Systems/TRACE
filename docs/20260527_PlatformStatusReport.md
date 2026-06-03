# TRACE Platform — Status Report

**Date:** 27 May 2026
**Branch:** `staging`

---

## 1. Executive Summary

TRACE is a blockchain-enabled digital marketplace for construction material reuse. The platform is **functionally built** — all core user flows have been coded — but it is **not yet production-ready for beta testing**. Approximately 80–85% of the target feature set is implemented. The remaining blockers are a mix of critical bugs, missing UI features, and hardening work. With focused effort, the platform can be beta-ready in **5–7 developer days**.

The staging environment (`trace-staging.adventurous.systems`) is ahead of production (`trace.adventurous.systems`) by 5 commits and contains the most current and tested state of the codebase. Production is currently serving an earlier build.

---

## 2. What Has Been Built

### `@trace/core` — Complete

Shared types, Zod validators, constants, and utilities used by all other packages.

- All domain types: `MaterialPassport`, `User`, `Listing`, `Transaction`, `QualityReport`, `Organisation`, `EPCISEvent`
- All validators: Auth, Passport, Listing, Quality, Access-Request
- 60+ material categories with subcategories, role enums, blockchain reward constants
- 8 custom error classes, Pino structured logger

### `@trace/db` — Complete

- **13 database tables:** `organisations`, `users`, `material_passports`, `passport_events`, `listings`, `transactions`, `quality_reports`, `beta_access_requests`, `sensor_readings`
- Full FK relations, 2 migration files, seed script with demo users and orgs
- Singleton DB client with connection pooling

### `@trace/api` — 80% Complete

- **30+ routes** across 6 modules:
  - **Auth:** login, register, get current user
  - **Passports:** full CRUD, blockchain verify, EPCIS event history, QR code generation
  - **Marketplace:** listing CRUD, offer/transaction management
  - **Quality:** report submission, dispute flow
  - **Access Requests:** full admin approval/rejection/revocation workflow
  - **Health:** DB connectivity check
- BullMQ background worker that anchors passports to VeChain via keccak256 hash
- MinIO file storage (bucket auto-creation), rate limiting, JWT middleware, CORS

### `@trace/web` — 75% Complete

- **19 pages:** landing, auth, dashboard, passports, listings, marketplace, transactions, quality, admin, public passport view, QR scanner, access request
- Fully typed API client with 50+ endpoints
- shadcn-style UI components (Button, Badge, Card, Input, Label)
- Multi-step passport registration wizard, QR scanner component

### `@trace/contracts` — Complete

- `MaterialRegistry.sol` — passport integrity anchoring (keccak256 proofs, HUB_ROLE/ADMIN_ROLE)
- `QualityAssurance.sol` — report registry with dispute mechanism
- `CircularMarketplace.sol` — on-chain listing/transaction/escrow
- Hardhat configured for VeChain Solo + testnet, deploy script included

### `@trace/sdk` — Intentional stub (post-API-stable)

---

## 3. Staging vs. Production — Current Differences

| Attribute | Staging | Production |
|---|---|---|
| **Domain** | `trace-staging.adventurous.systems` | `trace.adventurous.systems` |
| **Git Branch** | `staging` | `main` |
| **Server Path** | `/opt/TRACE-staging` | `/opt/TRACE` |
| **Web Port** | 4003 | 3003 |
| **API Port** | 4004 | 3004 |
| **Infra Ports** | Postgres 15433, Redis 16380, MinIO 29000, Meilisearch 17701, Thor 8670 | Different (non-conflicting) port mapping |
| **Code State** | 5 commits ahead of `main` | Missing all recent feature work |

### What staging has that production does not

| Commit | What It Added |
|---|---|
| `8a26e28` | Fix: MinIO public URL uses `MINIO_PUBLIC_URL` for externally accessible asset URLs |
| `3c2bf70` | Docs: signup and access management flow documentation |
| `7ffaab7` | Feature: full admin access management + buyer reapply flow |
| `0bfc83c` | Feature: buyer signup, access requests, release workflows |
| `4a5b22d` | Infra: Dockerized staging environment |

**In practical terms:** Production is missing the entire buyer signup, access request, and admin access management system. It also has the broken MinIO URL bug that makes uploaded assets inaccessible. **Production should not be used for user testing in its current state.**

### Infrastructure notes

- Both environments run Docker Compose behind nginx with identical service architecture
- Staging and production use different port numbers on the host to avoid conflicts
- `MEILI_ENV` is set to `development` in the Docker Compose — this should be `production` on the production server
- Both environments expect their own `.env` file on the server; secrets are not in the repo
- The CI/CD pipeline described in `GIT_WORKFLOW.md` has **not been configured** — no `.github/workflows/` directory exists; all deploys are currently manual

---

## 4. What Is Missing / Incomplete

| Area | Gap | Impact |
|---|---|---|
| **Image uploads** | `conditionPhotos` field exists in schema but no file upload UI or API route | Passports cannot include material photos |
| **Marketplace search** | No faceted filter UI (category, condition, price) | Buyers cannot narrow search results |
| **Pagination** | Most pages hardcode `limit: 5` or `limit: 20` with no prev/next controls | Unusable at scale |
| **Transaction dispute UI** | Routes exist but no UI for dispute/resolve actions | Disputes cannot be managed by users |
| **Quality report photos** | Form exists, no photo upload input | Inspector reports are text-only |
| **Meilisearch** | Configured in Docker + env but zero code uses it — all search is in-memory | Search breaks at any meaningful data volume |
| **Sensor data routes** | `sensor_readings` table exists, no POST/GET API routes | IoT integration is a dead end |
| **Governance/Hub Registry/Oracle contracts** | Addresses referenced in env but contracts not written | These features are not deployable |
| **CBT Token** | Rewards tracked in DB only, not on-chain | Token economics are simulated only |
| **Fee delegation** | `FEE_DELEGATOR_URL` env var exists; worker ignores it | Users would need VTHO to pay gas — contradicts the UX promise |
| **Email verification** | No email verification on signup | Anyone can register with a fake address |
| **CI/CD pipeline** | No `.github/workflows/` directory — deploy automation is documented but not configured | Deploys are manual and error-prone |
| **Next.js auth middleware** | No `middleware.ts` — auth guard is client-side only | SSR pages flash before redirect; not secure |
| **Tenant middleware** | `middleware/tenant.ts` exists but never registered in `server.ts` | Tenant isolation is not enforced |

---

## 5. Bugs That Need Fixing

### Critical — Blocking Beta

| # | Bug | Location | Fix |
|---|---|---|---|
| 1 | **Typo `offerPencE`** (capital E) — field name inconsistency across validator and API client | `packages/core/src/validators/listing.schema.ts`, `packages/web/src/lib/api-client.ts` | Rename to `offerPence` in both files |
| 2 | **QR code generation runs in test env** — passport creation fails without MinIO running | `packages/api/src/modules/passport/passport.service.ts` lines 47–62 | Skip MinIO upload when `NODE_ENV === 'test'` |
| 3 | **Anchor worker silently does nothing if `MATERIAL_REGISTRY_ADDRESS` unset** — passports appear created but are never anchored to VeChain | `packages/api/src/workers/anchor-passport.worker.ts` lines 111–114 | Reject the job and surface the error; validate env at startup |
| 4 | **JWT expiry not checked client-side** — expired tokens stay in localStorage and are sent until the API rejects them | `packages/web/src/lib/auth.ts` | Check `exp` claim on token before each request |
| 5 | **No Next.js auth middleware** — dashboard routes have no server-side auth guard | Missing `middleware.ts` in `packages/web/src/` | Add `middleware.ts` to redirect unauthenticated users from `/dashboard/*` to `/login` |

### Important — Affecting UX and Data Integrity

| # | Bug | Location | Fix |
|---|---|---|---|
| 6 | **Marketplace search is O(n) in-memory** — filters applied after fetch, `total` count is pre-filter, pagination is incorrect | `packages/api/src/modules/marketplace/marketplace.service.ts` lines 183–212 | Push filters into SQL `WHERE` clause |
| 7 | **Quality report missing `with: { inspector }` relation** — `r.inspector` will always be `undefined` | `packages/api/src/modules/quality/quality.service.ts` ~line 75 | Add `with: { inspector: true }` to `findMany` |
| 8 | **Duplicate pending access requests allowed** — only checks buyer + first request | `packages/api/src/modules/access-request/access-request.service.ts` lines 155–157 | Change check to `status === 'pending'` regardless of role |
| 9 | **No cascade deletes in DB schema** — deleting a passport leaves orphaned listings and transactions | `packages/db/drizzle/schema.ts` FK definitions | Add `onDelete: 'cascade'` to FK definitions |
| 10 | **MinIO buckets created lazily** — first passport creation could fail if bucket doesn't exist yet | `packages/api/src/lib/storage.ts` | Ensure bucket creation in `buildApp()` at startup |

### Code Quality

| # | Issue | Location |
|---|---|---|
| 11 | 4× `as any` casts in marketplace service | `packages/api/src/modules/marketplace/marketplace.service.ts` lines 55, 428, 450, 454 |
| 12 | `createdAt: string` type but DB returns `Date` | `packages/core/src/types/quality.ts` |
| 13 | Anchor worker starts in test env — causes hanging Redis connections | `packages/api/src/index.ts` |
| 14 | `MEILI_ENV: development` in Docker Compose (should be `production` for prod) | `docker-compose.yml` line 100 |
| 15 | `NEXT_PUBLIC_API_URL` not documented in `.env.example` | Root `.env.example` |

---

## 6. What's Needed to Be Production-Ready for Beta

### Immediate — Before Any User Testing

1. **Fix the 5 critical bugs** listed above
2. **Promote staging to production** — merge `staging` → `main` so production has the current access management system and MinIO fix
3. **Configure GitHub Actions CI/CD** — the deploy workflow is documented in `GIT_WORKFLOW.md` but the `.github/workflows/` files don't exist; without this, all deploys are manual and error-prone
4. **Deploy smart contracts to VeChain testnet** — currently only Thor Solo (local) is used; staging/prod need a persistent testnet deployment so anchoring actually works
5. **Set production environment secrets** — `JWT_SECRET` must be a strong random secret, `DEPLOYER_PRIVATE_KEY` must be set, all contract addresses populated after deployment
6. **Set `MEILI_ENV: production`** in the production Docker Compose

### Before Beta Launch

7. **Image upload** — API route and UI for `conditionPhotos` on passports and quality report photos
8. **Marketplace SQL filtering** — replace in-memory O(n) filter with DB-level `WHERE` to fix pagination and scalability
9. **Pagination UI** — prev/next controls on passport list, marketplace, transactions, quality reports
10. **Email notifications** — at minimum: access request approved/rejected, new offer on listing
11. **Email verification on signup** — prevents fake account registration
12. **Transaction dispute UI** — buyers and sellers need to flag and resolve disputes
13. **Basic monitoring/alerting** — error rate and uptime visibility (Uptime Kuma or equivalent)

### Nice-to-Have Before Showcase

14. Meilisearch integration for full-text search across passports and listings
15. Marketplace filter UI (category, condition grade, price range)
16. Dashboard charts (passport count trend, listing activity, transaction volume)

---

## 7. Questions to Ask the Team

### Deployment & Infrastructure (no answers needed, as we are the developer)

1. **Are the GitHub Actions secrets configured in the GitHub repo settings?** (`TRACE_STAGING_SSH_HOST`, `TRACE_STAGING_SSH_USER`, `TRACE_STAGING_SSH_KEY`, and production equivalents.) The deployment workflows don't exist yet — who is owning this?
2. **Is there a VeChain testnet wallet and VTHO balance provisioned for staging and production?** The anchor worker needs a funded wallet and a deployed `MaterialRegistry` contract address, or blockchain anchoring silently does nothing.
3. **What is the current state of the VPS environments?** Are the Docker containers actually running on staging and production right now, and have migrations been applied?
4. **Is there a `.env` file on each server with production values?** Specifically: is `JWT_SECRET` a strong random secret, and is `DEPLOYER_PRIVATE_KEY` set?
5. **Is nginx configured with the `/api/` routing rule on both servers?** Without it, browser API calls will fail. The config template is at `docs/nginx/trace-web.same-origin-api.conf.example`.

### Product & Beta

6. **Who are the beta users, and what roles will they have?** This determines whether the manual admin-only access-request approval flow is the right onboarding path, or whether invites/pre-approved accounts are needed.
Answer: Use their email addresses, give temp password, they sign in and change the password. (depending on current user flow, and if it give the same result)
7. **Is VeChain anchoring a hard requirement for beta, or can passports be created without blockchain confirmation for the initial showcase?** This changes the urgency of deploying and funding the contracts.
Answer: VPS first, then check for live testnet is feasible to deploy on VeChain testnet for 8-June-2026. 
8. **What does "showcase" mean concretely — a live demo with real materials, or a scripted walkthrough?** A scripted demo can work with seeded test data; a live demo requires production contracts and a real MinIO bucket.
Answer: Live demo for all attendees, then attendees break into groups and test it. Integrated website/ platform feedback and analytics, is it feasible?
9. **Is the CBT token and on-chain rewards part of the beta scope, or just the marketplace and passport flows?** The token contract does not exist in the current codebase.
Answer: Deferring for the next stage. No token integration for now.
10. **Is Stirling Reuse Hub still the first pilot hub?** If so, do we have their material data to seed, and is there a hub admin account ready for them?
Answer: Awaiting feedback on material/ product list

Additional questions that arose from the meeting:
11. How will users use the platform after the workshop and session has completed
12. Aim to start a TRACE community the day of the workshop, WhatsApp. 

### Development Priorities (no answers needed, as we are the developer)

11. **Who is responsible for the smart contract deployment to testnet?** This is a blocker for blockchain anchoring and needs a specific owner and timeline.
12. **Is there a QA process or does everything go straight from staging to production?** The runbook describes manual QA steps but there is no automated test suite — is this acceptable for beta?
13. **Are email notifications in scope for beta, or are we notifying users out-of-band for now?** There is no email provider configured anywhere in the codebase.
14. **The `PLAN.md` file is dated 2026-02-23 and says Sprint 1 hasn't started, but clearly much more has been built since then. Is there an updated sprint plan?** The team should align on the actual current sprint and what is committed for beta.

---

## 8. Summary Assessment

| Dimension | Status |
|---|---|
| Core data model | Complete |
| API routes | Complete (30+ routes, all major flows) |
| Web UI | Mostly complete (missing uploads, filters, pagination) |
| Smart contracts | Written but not deployed to testnet/mainnet |
| Blockchain anchoring | Coded but silently fails in staging/prod |
| Auth & access management | Complete on staging; not yet on production |
| Search | Not implemented (in-memory, breaks at scale) |
| CI/CD | Documented but not configured |
| Test coverage | <10% — very low |
| Production secrets | Unknown — needs verification |
| **Beta-readiness** | **Not yet — 5–7 focused dev days required** |
