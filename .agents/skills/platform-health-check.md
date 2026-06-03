---
name: platform-health-check
description: >
  Master orchestrator skill for a full TRACE platform health check. Use when: the user
  says "perform a health check", "run all skills", "audit the platform", "check platform
  status", or any request to assess overall system health across blockchain anchoring,
  DB schema, API routes, test coverage, auth flows, and UI simultaneously.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
context: fork
---

# Skill: Platform Health Check Orchestrator (`platform-health-check`)

## Name
platform-health-check

## Persona & Role
You are the Platform Engineering Lead running a full health audit of the TRACE system. You coordinate across all specialist domains and produce a unified executive summary. You never report GREEN without actually running the check.

## Execution Sequence

Run each domain check in order. Do NOT run any DB migrations, contract deployments, or blockchain transactions — these are side-effecting operations and must never be triggered by a health check.

---

### 1. Blockchain Anchor Pipeline Check (`passport-anchor-guard` domain)
- Grep `packages/api/src/workers/anchor-passport.worker.ts` for `secp256k1` — confirm VeChain native signing is used (not `ethers.Wallet.signTransaction`).
- Check `packages/api/src/lib/queue.ts` — confirm retry strategy is configured (attempts, backoff delay).
- Grep `packages/api/src/workers/anchor-passport.worker.ts` for `Object.fromEntries.*sort` — confirm canonical JSON-LD key sorting is in place.
- Check env config: `MATERIAL_REGISTRY_ADDRESS`, `VECHAIN_NODE_URL`, `DEPLOYER_PRIVATE_KEY` documented in `.env.example` or `env.ts`.
- Bash: `pnpm --filter @trace/contracts build 2>&1 | tail -5` — confirm contracts compile cleanly.

---

### 2. Schema Safety Check (`schema-pilot` domain)
- Read `packages/db/drizzle/schema.ts` — note the table count and last modification.
- Glob `packages/db/drizzle/migrations/` — list the 3 most recent migration files.
- Grep `packages/api/src/modules/` for `.from(materialPassports)` without a nearby `organisationId` — flag org-filter violations.
- Grep `packages/api/src/modules/` for `with: {` to find unbounded eager-load relations.
- Check that `users`, `betaAccessRequests`, `materialPassports`, `listings`, `transactions`, `qualityReports` are all present in schema.ts.

---

### 3. API Route Coverage Check (`api-cartographer` domain)
- Glob `packages/api/src/modules/**/*.routes.ts` — count route files.
- Grep each route file for `fastify.get\|fastify.post\|fastify.put\|fastify.patch\|fastify.delete` — count total routes.
- Grep route files for `preHandler` — flag protected routes missing auth middleware.
- Read `packages/api/src/server.ts` — verify all modules are registered.
- Grep for `success:` in route handlers — spot-check envelope compliance.

---

### 4. Test Suite Check (`test-engineer` domain)
- Bash: `pnpm --filter @trace/api test --reporter=verbose 2>&1 | tail -10`
- Report pass/fail counts.
- Glob `packages/api/src/modules/**/*.test.ts` — list existing test files.
- Flag modules without a corresponding `.test.ts` (passport, marketplace, quality likely missing).
- Check `packages/contracts/test/` — list contract test files; flag missing QualityAssurance.test.ts and CircularMarketplace.test.ts.

---

### 5. Smart Contract Safety Check (EthSkills `security` domain)
- Grep `packages/contracts/contracts/CircularMarketplace.sol` for `disputeDeadline` — confirm it's checked in `flagDispute`.
- Grep `packages/contracts/contracts/CircularMarketplace.sol` for `_passportListing` in `cancelTransaction` — confirm mapping is restored.
- Grep `packages/contracts/contracts/QualityAssurance.sol` for `require(` — flag any remaining `require` strings (should all be custom errors).
- Grep `packages/contracts/contracts/MaterialRegistry.sol` for `MAX_BATCH_SIZE` — confirm batch cap exists.
- Bash: `pnpm --filter @trace/contracts build 2>&1 | grep -E "Warning|Error" | head -20`

---

### 6. Auth & Access Flow Check (`auth-state-machine` domain)
- Read `packages/api/src/modules/auth/auth.service.ts` — verify constant-time password comparison (dummy hash pattern).
- Read `packages/core/src/validators/auth.schema.ts` — verify `LoginSchema` password is `min(8)`.
- Read `packages/api/src/modules/access-request/access-request.service.ts` — verify approval uses a DB transaction wrapping both user update and access request status update.
- Read `packages/api/src/middleware/auth.ts` — verify `authenticate` and `authorize` are separate, composable middleware.

---

### 7. UI Health Check (`aesthetic-vision` domain)
- Glob `packages/web/app/**/*.tsx` — count page files.
- Grep `packages/web/app/` for `'use client'` — spot-check that client components are not overused on data-fetching pages.
- Grep `packages/web/app/` for `style={{` — flag inline style usage.
- Grep `packages/web/` for `<table` without nearby `overflow-x` — flag missing scroll wrappers.
- Grep `packages/web/` for `useState.*fetch` or `useEffect.*fetch` — flag anti-patterns where TanStack Query should be used.

---

## Expected Output Format

```markdown
# TRACE Platform Health Check — [DATE]

## Executive Summary
| Domain | Status | Critical Issues |
|--------|--------|-----------------|
| Blockchain Anchor Pipeline | [GREEN/AMBER/RED] | [count or "none"] |
| Schema Safety | [GREEN/AMBER/RED] | [count or "none"] |
| API Route Coverage | [GREEN/AMBER/RED] | [count or "none"] |
| Test Suite | [GREEN/AMBER/RED] | [count or "none"] |
| Smart Contract Safety | [GREEN/AMBER/RED] | [count or "none"] |
| Auth & Access Flow | [GREEN/AMBER/RED] | [count or "none"] |
| UI/UX | [GREEN/AMBER/RED] | [count or "none"] |

**Overall: [GREEN / AMBER / RED]**

## 1. Blockchain Anchor Pipeline
[findings]

## 2. Schema Safety
[findings]

## 3. API Route Coverage
[findings]

## 4. Test Suite
[findings]

## 5. Smart Contract Safety
[findings]

## 6. Auth & Access Flow
[findings]

## 7. UI/UX
[findings]
```

**Status definitions:**
- GREEN — no issues found
- AMBER — issues present but non-blocking
- RED — blocking issues requiring immediate action (build failures, critical bugs, missing auth)

## Negative Constraints
- **NEVER** run `pnpm --filter @trace/db migrate` or `pnpm --filter @trace/contracts deploy:solo` as part of a health check.
- **NEVER** report GREEN on any domain without actually running its check commands.
- **NEVER** mark overall health GREEN if any single domain is RED.
- **NEVER** merge domain sections — keep them separated under their heading.
