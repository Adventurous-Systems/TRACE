# Codebase Status Audit Report

Date: 2026-06-03
Audited workspace: `/dev-github/TRACE`
Active branch: `staging`

## 1. Executive Summary

TRACE is a pnpm/Turbo TypeScript monorepo for a material passport and reuse marketplace. The current `staging` branch is substantially ahead of `main` and contains access management, workshop feedback, database migrations, Docker/GitHub Actions deployment, and VeChain anchoring work.

Overall status: partially healthy, not production-ready for merge today.

Confirmed blockers:
- `pnpm typecheck` fails in `@trace/contracts` at `packages/contracts/scripts/deploy.ts:26`.
- `@trace/contracts` tests compile but fail on `vechain_solo` because no signer is available.
- `@trace/api` tests cannot run with current local service/env state because tests default to Postgres `5432` and Redis `6379`, while local Docker services expose `15432` and `16379`.
- `GET /api/v1/marketplace/transactions/:id` authenticates but does not enforce buyer/seller ownership.
- Any authenticated user can dispute any quality report.

Confirmed strengths:
- API routes are modular and mostly protected with Fastify JWT pre-handlers.
- Core input validation uses Zod.
- Workflows are SHA-pinned and have least-privilege `contents: read`.
- `staging-server-snapshot-2026-06-03` has been merged into `staging`.
- No real tracked `.env` file was found; only `.env.example` is tracked.

## 2. Repository and Branch Overview

| Item | Confirmed State |
|---|---|
| Current branch | `staging` |
| Current HEAD | `62f2b31` |
| Main branch | `main` / `origin/main`, HEAD `2a5a95a` |
| Snapshot branch | `origin/staging-server-snapshot-2026-06-03`, merged into `staging` |
| Worktree | Dirty: six root planning docs deleted and reappearing as untracked `docs/archive/*` |
| Deployment docs | Production `trace.adventurous.systems`, staging `trace-staging.adventurous.systems` |

Evidence:
- Branch strategy and environment map: `GIT_WORKFLOW.md:15-20`.
- Deploy contract: `GIT_WORKFLOW.md:108-119`.
- Local worktree state from `git status --short`: deleted root docs plus untracked `docs/archive/`.

## 3. Technology Stack

| Technology | Where Found | Purpose | Status | Risks |
|---|---|---|---|---|
| pnpm `9.15.9`, Turbo | `package.json:5`, `package.json:10-25` | Monorepo scripts | Active | None material |
| Node >=20 | `package.json:6-8` | Runtime | Active | Must match VPS/CI |
| Next.js 14, React 18 | `packages/web/package.json:31-34` | Web frontend | Active | Auth token storage not HttpOnly |
| Fastify 5 | `packages/api/package.json:15-32` | Backend API | Active | Some route-level auth gaps |
| Drizzle ORM, Postgres | `packages/db/package.json:18-24` | Database | Active | Migration state must be verified on VPS |
| Redis, BullMQ | `packages/api/package.json:24,29` | Anchor queue | Active | Local test env mismatch |
| MinIO | `packages/api/package.json:30`, `docker-compose.yml:76-93` | QR/photo/report storage | Active | Public URL/bucket policy must be checked |
| Meilisearch | `docker-compose.yml:95-110` | Search service | Configured | Not visibly used in code yet |
| VeChain SDK/Hardhat | `packages/api/package.json:21-22`, `packages/contracts/package.json:14-31` | Blockchain anchoring/contracts | Active but not live | Tests/config not passing locally |
| Zod | `packages/core/src/validators/*` | Validation | Active | Good |
| GitHub Actions | `.github/workflows/*.yml` | CI/deploy | Active | Secrets/server state unknown |

No Stripe/payment package, payment webhook, or billing implementation was found in active packages.

## 4. Branch Comparison: Staging vs Production

`git diff main...staging --stat` shows 225 changed files with roughly 36,900 insertions and 1,920 deletions. Major differences:

| Area | Main / Production | Staging | Risk | Recommendation |
|---|---|---|---|---|
| Access management | Older access stack | Buyer signup, access requests, admin management | Medium | Test before merge |
| Feedback | Absent | `feedback_submissions`, widget, admin page | Medium | Apply migration before deploy |
| DB schema | Older schema | Migrations `0001`-`0005`, cascade deletes, audit/blockchain tables | High | Confirm VPS migration state |
| Blockchain | Earlier implementation | Fee delegation, org wallets, audit routes, contracts | High | Do not enable testnet until tests pass |
| CI/CD | No workflows on main side of diff | CI/deploy workflows added | Medium | Confirm GitHub secrets and deploy success |
| Docker ports | Different older local ports | Staging ports `4003/4004`, infra `15433/16380/29000/17701/8670` | Medium | Align local `.env`/tests and VPS ports |

## 5. Environment and Server Comparison

Repository evidence only; no SSH/server access was available.

| Environment | Branch / Commit | URL | Database | Auth | Storage | Notes / Risks |
|---|---|---|---|---|---|---|
| Production | `main` / `2a5a95a` | `trace.adventurous.systems` | Unclear | JWT | MinIO | Must verify `.env`, migrations, nginx, DB separation |
| Staging | `staging` / `62f2b31` | `trace-staging.adventurous.systems` | Unclear | JWT | MinIO | Must run VPS smoke test before workshop |
| Local Docker | Existing older stack | `localhost:3003/3004` from running containers | Exposed `15432` | JWT | MinIO `19000` | Does not match current compose host ports |

Required manual checks:
- Staging and production must not share the same database.
- `JWT_SECRET` must be strong and unique per environment.
- `MEILI_ENV=production` must be set in production `.env`.
- `MATERIAL_REGISTRY_ADDRESS` should remain unset for the June 8 workshop.
- nginx `/api/*` routing must hit Fastify, not Next.js.

## 6. Architecture Map

| Path | Purpose |
|---|---|
| `packages/web` | Next.js app router frontend, dashboard, marketplace, admin pages |
| `packages/api` | Fastify API, middleware, route modules, storage, audit, queue, VeChain worker |
| `packages/core` | Shared types, constants, errors, Zod validators |
| `packages/db` | Drizzle schema, migrations, seed/migrate scripts |
| `packages/contracts` | Solidity contracts, Hardhat config, deployment script, contract tests |
| `packages/sdk` | Small shared SDK package |
| `.github/workflows` | CI and SSH deploy workflows |
| `docs` | Runbooks, sprint plan, nginx example, status reports |
| `scripts` | Auth and E2E smoke scripts, Thor Solo reset script |

API registration is centralized in `packages/api/src/server.ts:69-77`.

## 7. User Flows

| Flow | Entry Points | API Routes | DB Tables | Auth | Risks |
|---|---|---|---|---|---|
| Public visitor | `/`, `/marketplace`, `/passport/:id`, `/scan` | Public marketplace/passport/quality reads | `listings`, `material_passports`, `quality_reports` | Public | Public history/report exposure should be intentional |
| Signup/login | `/register`, `/login` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | `users` | Public/login | JWT stored in localStorage and non-HttpOnly cookie |
| Access request | `/access-request`, `/admin/access-requests` | `/access-requests/*` | `beta_access_requests`, `users`, `organisations` | Buyer/platform admin | API approval is platform-admin only |
| Passport management | `/passports`, `/passports/new`, `/passports/:id` | `/passports/*` | `material_passports`, `passport_events` | Hub/platform roles | Queues anchoring even when workshop anchoring is intentionally off |
| File upload | Passport detail upload | `POST /passports/:id/photos` | `material_passports.condition_photos`, MinIO | Hub/platform roles | MIME-only validation; no image content scan |
| Marketplace | `/marketplace`, `/listings`, `/transactions` | `/marketplace/*` | `listings`, `transactions` | Mixed | Single transaction read lacks ownership check |
| Quality | `/quality`, `/quality/new` | `/quality/reports/*` | `quality_reports` | Inspector/hub/platform for create; public reads | Any authed user can dispute |
| Feedback | Floating dashboard widget, `/admin/feedback` | `/feedback` | `feedback_submissions` | Public submit; admin read | Public endpoint is rate-limited globally only |
| Blockchain/audit | `/admin/activity`, `/explorer/tx/:txHash` | `/audit/*`, `/blockchain/transactions/:txHash` | `audit_events`, `blockchain_transactions` | Platform admin/public tx lookup | Testnet go-live still blocked |

## 8. Data Flows

| Data Type | Created From | Stored In | Displayed In | External Services | Risks |
|---|---|---|---|---|---|
| Users | Signup/seed/admin access update | `users` | Dashboard/admin | None | Password auth only; no email verification |
| Access requests | Buyer form | `beta_access_requests` | Access/admin pages | None | Platform-admin bottleneck |
| Passports | Register wizard/API | `material_passports`, `passport_events` | Public and dashboard pages | MinIO, optional VeChain | Draft visibility partly enforced by service |
| Photos/QR | Upload/QR generation | MinIO URL in DB | Passport pages | MinIO | Public bucket policy must be verified |
| Listings | Hub listing form | `listings` | Marketplace/listings | None | No real payment/escrow |
| Transactions | Offer flow | `transactions` | Orders | None | IDOR on single read |
| Quality reports | Inspector form | `quality_reports` | Public/report pages | Optional contracts in future | Public inspector email exposure |
| Feedback | Widget/API | `feedback_submissions` | Admin feedback | None | Public spam risk |
| Blockchain logs | Worker/routes | `blockchain_transactions` | Admin/activity/explorer | VeChain node/delegator | Go-live unverified |

## 9. Database Usage

Main tables are in `packages/db/drizzle/schema.ts`.

| Table | Purpose | Create | Read | Update | Delete | Risks |
|---|---|---|---|---|---|---|
| `organisations` | Hubs/orgs and wallet metadata | Admin approval/seed | Many modules | Admin/wallet setup | No hard delete route | Encrypted private key column needs strong key/KMS |
| `users` | Accounts and roles | Register/seed | Auth/admin | Access admin | No hard delete route | No email verification/MFA |
| `beta_access_requests` | Role elevation workflow | Buyer | Buyer/admin | Platform admin | No hard delete route | Good auditability |
| `material_passports` | Core material passport | Hub | Public/org | Hub | No API delete seen | Public data classification needed |
| `passport_events` | EPCIS-style history | Passport/marketplace | Public history | No | Cascade via passport | Public history should be intentional |
| `audit_events` | Audit trail | Hooks/routes | Platform admin | No | No | Good |
| `blockchain_transactions` | VeChain tx log | Worker | Admin/public tx | Worker | No | Needs tested anchoring |
| `listings` | Sale listings | Hub | Public/org | Hub | Cascade via passport | Status model is simple |
| `transactions` | Offer/order lifecycle | Buyer offer | User list, single read | Buyer/seller actions | Cascade via listing | Single read IDOR |
| `quality_reports` | Inspection reports | Inspector/hub/platform | Public | Dispute | Cascade via passport | Dispute auth too broad |
| `sensor_readings` | Future IoT readings | Not found | Not found | Not found | Cascade | Currently unused |
| `feedback_submissions` | Workshop feedback | Public | Admin/hub admin | No | No | Spam/rate limiting |

## 10. API and Backend Review

| Route Area | Auth | Validation | Risk |
|---|---|---|---|
| `/health` | Public | None | Low |
| `/auth/login`, `/auth/register`, `/auth/me` | Public/public/auth | Zod | JWT storage model is production-hardening item |
| `/access-requests` | Auth/platform admin | Zod | Good server-side role enforcement |
| `/passports` | Mixed public/private | Zod + MIME upload checks | Public endpoints expose active passport data |
| `/marketplace/listings` | Public/hub roles | Zod | Good listing ownership checks |
| `/marketplace/offers` | Buyer/hub/admin | Zod | Creates transaction directly; no payment |
| `/marketplace/transactions/:id` | Auth only | Zod for patch only | High: read endpoint lacks ownership check |
| `/quality/reports` | Mixed | Zod | Medium/high: dispute endpoint auth too broad |
| `/feedback` | Public submit, admin read | Zod | Medium: public spam risk |
| `/audit` | Platform admin | Limit parser | Good |
| `/blockchain/transactions/:txHash` | Public | Params only | Acceptable if tx data considered public |

## 11. Frontend Review

Frontend pages are in `packages/web/src/app`. Dashboard navigation is role-aware in `packages/web/src/components/DashboardLayout.tsx:35-55`, but API authorization is the real enforcement. Middleware protects dashboard/internal prefixes using the `trace_auth` cookie in `packages/web/src/middleware.ts:3-34`.

Risks:
- Token storage uses `localStorage` plus a readable cookie; `packages/web/src/lib/auth.ts:3-6` explicitly notes HttpOnly cookie should be used in production.
- Buyer nav includes `/transactions`, but middleware protects `/transactions`; route file under dashboard group exists as `/transactions`.
- Feedback widget uses non-ASCII UI glyphs; not a risk, just style consistency.

## 12. Auth and Permissions

Auth model: self-signup creates `buyer` users only; login returns a signed Fastify JWT; API routes call `authenticate` and `authorize`. Frontend also stores session locally and sets a cookie so middleware can redirect unauthenticated users.

| Role | Can Access | Where Enforced | Risks |
|---|---|---|---|
| `buyer` | Marketplace, offers, own transactions, access request | API routes + frontend nav | Can read arbitrary transaction by id |
| `hub_staff` | Passports/listings, offers, transactions | API role checks | Can create offers too |
| `hub_admin` | Hub flows, feedback admin, quality, activity nav | Mixed | Cannot approve access despite nav/admin visibility differences |
| `platform_admin` | Access admin, audit, broad platform actions | API role checks | High privilege |
| `inspector` | Create/list own quality reports | API role checks | Dispute route open to any authenticated role |

## 13. Payments and Billing

Can production payments currently work safely? No.

Reason: there is no active Stripe/payment/billing implementation in the codebase. Marketplace offers create internal `transactions` records and reserve listings/passports, but no money movement, checkout, webhook verification, refunds, or subscription state exists.

| Payment Area | Current Implementation | Production Status | Risk | Recommendation |
|---|---|---|---|---|
| Checkout | None | Not ready | High if treated as paid commerce | Label as enquiry/reservation only |
| Webhooks | None | Not ready | N/A | Add only when payments implemented |
| Transaction lifecycle | Internal DB statuses | Demo-ready | Medium | Clarify no payment has occurred |
| Smart contracts | Explicitly not handling actual payment | Future | Medium | Keep off for workshop |

## 14. External Services

| Service | Purpose | Env Vars | Production Risk |
|---|---|---|---|
| PostgreSQL | Primary DB | `DATABASE_URL` | DB separation/migrations unknown |
| Redis | Queue backend | `REDIS_URL` | Must be running for API tests/worker |
| MinIO | Object storage | `MINIO_*` | Public URL and bucket policy required |
| Meilisearch | Search | `MEILISEARCH_*`, Docker `MEILI_*` | Appears configured but not actively used |
| VeChain Thor node | Blockchain calls | `VECHAIN_NODE_URL` | Testnet go-live blocked |
| Fee delegator | VIP-191 sponsorship | `FEE_DELEGATOR_URL`, `FEE_DELEGATOR_PRIVATE_KEY` | Must be tested before go-live |
| GitHub Actions/SSH | Deployment | `TRACE_*_SSH_*` secrets | Secret presence unverified |
| Google Fonts | Frontend font | None | External network dependency |

## 15. Testing and QA Status

| Check | Command | Result | Risk | Recommendation |
|---|---|---|---|---|
| Typecheck | `pnpm typecheck` | Failed: `@trace/contracts` `deploy.ts:26` | High | Fix before merge |
| API tests | `pnpm --filter @trace/api test` | Failed: local DB/Redis not reachable on expected ports | Medium | Run with correct env or CI |
| Contract tests | `pnpm --filter @trace/contracts test` | Compiled, then 3 failures due missing signer | High for blockchain | Set Solo/deployer env or adjust test network |
| Docker status | `docker compose ps` | Local old stack running; Meili unhealthy | Medium | Reconcile current compose with existing containers |
| Workflow scan | Manual rg checks | No mutable `uses:`, no dangerous triggers found | Low | Run `zizmor` when installed |
| Secret scanners | `gitleaks`, `trufflehog`, `zizmor` | Not installed | Unknown | Install/run before production |

## 16. Security and Production Risks

Critical:
- None confirmed from available local evidence.

High:
1. Transaction IDOR: `GET /api/v1/marketplace/transactions/:id` calls `getTransactionById(id)` without caller ownership.
2. `pnpm typecheck` fails, so current `staging` should not be merged.
3. Blockchain test/deploy path is not locally passing; do not enable `MATERIAL_REGISTRY_ADDRESS` yet.

Medium:
1. JWT is stored in `localStorage` and a non-HttpOnly cookie.
2. Quality report dispute endpoint is too broad.
3. Public feedback endpoint can be spammed within global rate limits.
4. VPS env/database separation is unverified.
5. Local Docker state differs from current compose.
6. Meilisearch local container is unhealthy.

Low:
1. Large tracked Draw.io file adds repo weight.
2. Ignored build artifacts exist locally.
3. Some old docs are currently moved/deleted in the dirty worktree.

## 17. Known Issues and Unknowns

Known:
- `staging` is ahead of `main`.
- `staging-server-snapshot-2026-06-03` is merged into `staging`.
- Workshop doc still claims all packages typecheck clean, but fresh verification says otherwise.
- Current code intentionally leaves VeChain anchoring off for the workshop.

Unknown:
- Which exact commits are deployed on production/staging VPS.
- Whether staging and production share a DB.
- Whether VPS migrations `0001`-`0005` have been applied.
- Whether GitHub Actions SSH secrets exist and deploys pass.
- Whether nginx same-origin API routing is active.
- Whether live MinIO public URLs resolve on VPS.
- Whether production has strong, unique secrets.

## 18. Merge / Deployment Readiness

Ready:
- Access management feature shape.
- Feedback feature shape.
- CI/CD workflow hardening pattern.
- Local source architecture is understandable.

Not ready:
- Merge `staging` to `main` while `pnpm typecheck` fails.
- Enable VeChain testnet anchoring.
- Treat marketplace transactions as real paid commerce.
- Declare staging/production safe without VPS smoke tests.

## 19. Recommended Action Plan

| Priority | Action | Why It Matters | Owner | Effort | Risk If Ignored |
|---|---|---|---|---|---|
| P0 | Fix `packages/contracts/scripts/deploy.ts:26` typecheck failure | Merge blocker | Dev | Small | CI/build failure |
| P0 | Add ownership check to transaction read endpoint | Prevent data exposure | Dev | Small | Buyer/seller data leak |
| P0 | Run CI or local tests with correct DB/Redis env | Verify API | DevOps | Small | False confidence |
| P0 | Confirm staging/prod DBs and env files are separate | Production safety | DevOps | Small | Data contamination |
| P1 | Fix contract test signer/Solo setup | Blockchain readiness | Dev | Medium | Broken testnet go-live |
| P1 | Run actual staging VPS smoke test | Workshop readiness | QA/DevOps | Medium | Demo failure |
| P1 | Apply migrations on VPS | Feedback/cascade/features depend on it | DevOps | Small | Runtime 500s |
| P1 | Move JWT to HttpOnly secure cookie | Production auth hardening | Dev | Medium | XSS token theft impact |
| P1 | Narrow quality dispute permissions | Prevent bad state changes | Dev | Small | Abuse/noisy disputes |
| P2 | Install/run `gitleaks`, `trufflehog`, `zizmor` | Security assurance | DevOps | Small | Unknown secret/workflow risk |
| P2 | Reconcile local Docker compose ports | Developer reliability | DevOps | Small | Tests keep failing locally |
| P3 | Reduce/relocate large binary docs | Repo hygiene | Dev | Low | Slower repo operations |

## 20. Appendix: Commands Run and Evidence

Commands run:
- `pwd`
- `ls -la`
- `git status --short --branch`
- `git status --short`
- `git branch -a`
- `git log --oneline --decorate --graph --all --max-count=50`
- `git diff main...staging --stat`
- `git diff main...staging --name-only`
- `git diff staging...origin/staging-server-snapshot-2026-06-03 --stat`
- `rg --files ...`
- `find packages/api/src -type f`
- `find packages/web/src/app -type f`
- `nl -ba` on package files, schema, routes, services, workflows, runbooks, auth files
- Manual GitHub Actions security searches for mutable refs, dangerous triggers, permissions, and secrets usage
- Manual secret pattern search with `rg`
- `git ls-files | rg -i '(^|/)\\.env($|\\.)'`
- `find` for key/db files and large files
- `pnpm typecheck`
- `pnpm --filter @trace/api test`
- `pnpm --filter @trace/contracts test`
- `docker compose ps`

Security tool coverage:
- `gitleaks`: not installed
- `trufflehog`: not installed
- `zizmor`: not installed
- `gh`: installed

Key file evidence:
- Root scripts and package manager: `package.json:5-25`
- Env contract: `.env.example:6-80`, `packages/api/src/env.ts:3-65`
- API registration: `packages/api/src/server.ts:69-77`
- Auth middleware: `packages/api/src/middleware/auth.ts:9-39`
- Frontend middleware: `packages/web/src/middleware.ts:3-34`
- Client auth storage: `packages/web/src/lib/auth.ts:3-6`, `packages/web/src/lib/auth.ts:65-75`
- Transaction read risk: `packages/api/src/modules/marketplace/marketplace.routes.ts:180-187`, `packages/api/src/modules/marketplace/marketplace.service.ts:510-516`
- Quality dispute risk: `packages/api/src/modules/quality/quality.routes.ts:70-87`, `packages/api/src/modules/quality/quality.service.ts:114-129`
- DB schema: `packages/db/drizzle/schema.ts:18-584`
- Workflows: `.github/workflows/ci.yml:7-78`, `.github/workflows/deploy-staging.yml:9-37`, `.github/workflows/deploy-production.yml:9-37`
- Deployment environment map: `GIT_WORKFLOW.md:15-20`
- Auth/nginx runbook: `docs/AuthDeploymentRunbook.md:30-56`
