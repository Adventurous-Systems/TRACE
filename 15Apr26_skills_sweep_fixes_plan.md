# TRACE Platform Health Check — Fixes & Enhancements Plan
**Date:** 2026-04-15  
**Skills applied:** `api-cartographer`, `auth-security`, `auth-state-machine`, `schema-pilot`, `test-engineer`, `aesthetic-vision`, `platform-health-check`, `EthSkills` (security/audit)

---

## Executive Summary

| Domain | Status | Critical Issues |
|--------|--------|-----------------|
| Blockchain Anchor Pipeline | 🔴 RED | 6 FAIL — ethers signing broken, no canonical hash, contracts won't build |
| Smart Contract Safety | 🔴 RED | 2 CRITICAL bugs, 4 HIGH bugs across 3 contracts |
| Test Suite | 🔴 RED | 3 API modules untested, 2 contracts untested, no DB isolation |
| Schema Safety | 🟡 AMBER | No migrations generated, missing emailVerifiedAt column |
| Auth & Access Flow | 🟡 AMBER | LoginSchema too weak, JWT in localStorage, no reapply path |
| UI / Frontend | 🟡 AMBER | 8 pages using useEffect+fetch, localStorage XSS risk |
| API Route Coverage | 🟢 GREEN | 33 routes, all auth'd correctly — 1 minor issue (response schemas) |

**Overall: 🔴 RED — Not production-ready. Three domains are blocking.**

---

## TIER 1 — CRITICAL (Blocking / Data-Corrupting Bugs)

### 1. VeChain transaction signing is broken
**File:** [`packages/api/src/workers/anchor-passport.worker.ts:139-158`](packages/api/src/workers/anchor-passport.worker.ts#L139-L158)

`ethers.Wallet.signTransaction()` is used with a VeChain transaction body. VeChain and Ethereum use fundamentally different wire formats — the anchor worker has never successfully submitted a transaction to a real VeChain node. Every passport anchor silently fails.

**Fix:** Replace ethers signing with VeChain SDK native signing:
```typescript
import { Transaction, secp256k1 } from '@vechain/sdk-core';

const privKey = Buffer.from(
  process.env['DEPLOYER_PRIVATE_KEY']!.replace(/^0x/, ''),
  'hex'
);
const tx = new Transaction(txBody);
tx.signature = secp256k1.sign(tx.signingHash(), privKey);
const rawTx = '0x' + tx.encode().toString('hex');
const { id: txId } = await thorClient.transactions.sendRawTransaction(rawTx);
```
Remove the `Wallet` import from `ethers`; keep `keccak256` and `Interface`.

---

### 2. Hardhat contracts build is broken
**File:** [`packages/contracts/package.json`](packages/contracts/package.json)

`pnpm --filter @trace/contracts build` fails with:
```
Cannot find module '.../hardhat/types/network'
imported from hardhat-ethers/dist/src/type-extensions.js
```
`@nomicfoundation/hardhat-ethers` is incompatible with the installed `hardhat` version. No contracts can be compiled or deployed until this is resolved.

**Fix:** Align `hardhat` and `@nomicfoundation/hardhat-ethers` versions in `packages/contracts/package.json`. Run `pnpm --filter @trace/contracts install` after the update.

---

### 3. `cancelTransaction` corrupts `_passportListing` mapping
**File:** [`packages/contracts/contracts/CircularMarketplace.sol:331-352`](packages/contracts/contracts/CircularMarketplace.sol#L331-L352)

When a transaction is cancelled, `listing.status` is restored to `Active` but `_passportListing[passportId]` is **not** restored to the `listingId`. The passport becomes orphaned — `getPassportListing()` returns `bytes32(0)` and `createListing()` would succeed again for the same passport while the old listing still exists, creating a ghost duplicate.

**Fix:** Add one line after restoring listing status:
```solidity
// after: listing.status = ListingStatus.Active;
_passportListing[listing.passportId] = tx_.listingId;
```

---

### 4. `flagDispute` ignores the dispute deadline
**File:** [`packages/contracts/contracts/CircularMarketplace.sol:295-308`](packages/contracts/contracts/CircularMarketplace.sol#L295-L308)

`disputeDeadline` is stored on every `MarketTx` but is **never checked** inside `flagDispute()`. Buyers can raise disputes indefinitely after the settlement window has closed, undermining transaction finality.

**Fix:** Add a new error and a deadline guard:
```solidity
error DisputeWindowClosed(bytes32 txId);

// inside flagDispute(), before the status check:
if (block.timestamp > tx_.disputeDeadline) revert DisputeWindowClosed(txId);
```

---

### 5. JSON-LD canonical hash is not reproducible
**File:** [`packages/api/src/workers/anchor-passport.worker.ts:38-78`](packages/api/src/workers/anchor-passport.worker.ts#L38-L78)

`buildCanonicalJsonLd` calls `JSON.stringify(doc)` without sorting keys first. JavaScript object literal field order is stable within a single run but any future reordering of fields in source code would silently change every passport hash, invalidating all prior anchors.

**Fix:** Sort keys before stringifying:
```typescript
const sorted = Object.fromEntries(
  Object.entries(doc).sort(([a], [b]) => a.localeCompare(b))
);
return JSON.stringify(sorted);
```

---

## TIER 2 — HIGH (Must fix before production)

### 6. `resolveDispute` always completes — seller always wins
**File:** [`packages/contracts/contracts/CircularMarketplace.sol:313-326`](packages/contracts/contracts/CircularMarketplace.sol#L313-L326)

`resolveDispute()` always calls `_completeTx()` regardless of who was at fault. There is no way for an admin to cancel the transaction and restore the listing when ruling in the buyer's favour.

**Fix:** Add a `bool completeFavourSeller` parameter:
```solidity
function resolveDispute(bytes32 txId, bool completeFavourSeller)
    external onlyRole(ADMIN_ROLE) whenNotPaused
{
    MarketTx storage tx_ = _getTx(txId);
    if (tx_.status != TxStatus.Disputed) revert TxNotInExpectedState(txId, tx_.status);
    tx_.status = TxStatus.Resolved;
    emit DisputeResolved(txId, msg.sender, uint64(block.timestamp));

    if (completeFavourSeller) {
        _completeTx(txId, tx_);
    } else {
        tx_.status = TxStatus.Cancelled;
        Listing storage listing = _listings[tx_.listingId];
        listing.status = ListingStatus.Active;
        _passportListing[listing.passportId] = tx_.listingId;
        emit TransactionCancelled(txId, msg.sender, uint64(block.timestamp));
    }
}
```

---

### 7. `recordOffer` allows duplicate transaction IDs (state overwrite)
**File:** [`packages/contracts/contracts/CircularMarketplace.sol:226-266`](packages/contracts/contracts/CircularMarketplace.sol#L226-L266)

There is no check that `txId` doesn't already exist. Calling `recordOffer` twice with the same `txId` silently overwrites the prior `MarketTx`, losing buyer/seller/amount state.

**Fix:** Add after the zero-check on line 234:
```solidity
if (_transactions[txId].createdAt != 0) revert InvalidId(); // txId already exists
```

---

### 8. `QualityAssurance` uses `require` strings — 6 occurrences
**File:** [`packages/contracts/contracts/QualityAssurance.sol:93, 133-135, 160-161`](packages/contracts/contracts/QualityAssurance.sol#L93)

All reverts use `require("string")`, inconsistent with the other two contracts and wasting gas. Six occurrences across `registerInspector`, `anchorReport`, and `flagDispute`.

**Fix:** Add custom errors and replace all `require` calls:
```solidity
error InvalidAddress();
error ReportAlreadyAnchored(bytes32 reportId);
error EmptyHash();
error EmptyMaterialId();
error ReportNotFound(bytes32 reportId);
error ReportAlreadyDisputed(bytes32 reportId);
```

---

### 9. `QualityAssurance` constructor missing zero-address check
**File:** [`packages/contracts/contracts/QualityAssurance.sol:77-80`](packages/contracts/contracts/QualityAssurance.sol#L77-L80)

Both `MaterialRegistry` and `CircularMarketplace` guard `address(0)` in their constructors. QA doesn't — a zero admin address would lock the contract permanently with no recovery path.

**Fix:**
```solidity
constructor(address admin) {
    if (admin == address(0)) revert InvalidAddress();
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ADMIN_ROLE, admin);
}
```

---

### 10. `registerPassportBatch` uses `require` string and has no size cap
**File:** [`packages/contracts/contracts/MaterialRegistry.sol:146-150`](packages/contracts/contracts/MaterialRegistry.sol#L146-L150)

Uses `require(len == ..., "Length mismatch")` (only `require` string in an otherwise all-custom-error contract) and has no limit on batch size — an unbounded loop can run out of gas for large inputs.

**Fix:**
```solidity
error ArrayLengthMismatch();
error BatchTooLarge(uint256 size);
uint256 public constant MAX_BATCH_SIZE = 100;

// replace the require:
if (len != dataHashes.length || len != metadataUris.length) revert ArrayLengthMismatch();
if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len);
```

---

### 11. JWT stored in `localStorage` — XSS account takeover risk
**File:** [`packages/web/src/lib/auth.ts:29, 51`](packages/web/src/lib/auth.ts#L29)

Auth token is stored in `localStorage`, accessible to any XSS payload. The code itself has a comment saying "use httpOnly cookie in prod" — this was never implemented.

**Fix:** Migrate to `httpOnly; Secure; SameSite=Strict` cookie. The API sets the cookie on login/register and clears it on logout. The frontend reads identity from `GET /api/v1/auth/me` instead of parsing localStorage.

---

### 12. `LoginSchema` password minimum is `min(1)` not `min(8)`
**File:** [`packages/core/src/validators/auth.schema.ts:6`](packages/core/src/validators/auth.schema.ts#L6)

`RegisterSchema` enforces `min(8)` but `LoginSchema` allows single-character passwords. Inconsistent validation, allows weak attempts without client-side feedback.

**Fix:** Change to `password: z.string().min(8)`.

---

### 13. No migration files generated — schema deployment is undefined
**Path:** `packages/db/drizzle/migrations/` (directory is empty)

`drizzle-kit generate` has never been run. There is no migration baseline — schema drift between `schema.ts` and the actual database is unknown, and there is no repeatable path to apply the schema in a new environment.

**Fix:** Run `pnpm --filter @trace/db generate`, review the output, commit the files.

---

### 14. Passport, marketplace, and quality modules have zero API tests
**Missing files:**
- `packages/api/src/modules/passport/passport.test.ts`
- `packages/api/src/modules/marketplace/marketplace.test.ts`
- `packages/api/src/modules/quality/quality.test.ts`

Three of the six API modules — covering the core business flows — have no test coverage at all.

**Fix:** Create test files covering: create (success + auth failure + validation failure), list (with org scoping), get by ID (found + 404), and for marketplace: offer flow, cancel, dispute sequence.

---

### 15. `QualityAssurance` and `CircularMarketplace` have no contract tests
**Missing files:**
- `packages/contracts/test/QualityAssurance.test.ts`
- `packages/contracts/test/CircularMarketplace.test.ts`

The two contracts with the most critical bugs have zero test coverage. The new deadline check, dispute outcome parameter, and `_passportListing` restoration all need test coverage.

**Fix:** Create both test files covering: deployment, all role guards, every state transition with event emission, every custom error revert, and pause/unpause.

---

## TIER 3 — MEDIUM (Quality / Scalability / Best Practice)

### 16. `QualityAssurance` mappings unnecessarily `public`
**File:** [`packages/contracts/contracts/QualityAssurance.sol:48-54`](packages/contracts/contracts/QualityAssurance.sol#L48-L54)  
Change `reports`, `materialReports`, `inspectors` to `private`. Existing view functions (`getMaterialReports`, `verifyReport`, `getInspectorScore`) already provide all necessary access.

---

### 17. `getInspectorScore` underflow risk
**File:** [`packages/contracts/contracts/QualityAssurance.sol:192`](packages/contracts/contracts/QualityAssurance.sol#L192)  
If `disputedCount > reportCount` due to any logic error, unsigned subtraction silently underflows.  
**Fix:** Add `if (profile.disputedCount >= profile.reportCount) return 0;` before the subtraction.

---

### 18. `DEPLOYER_PRIVATE_KEY` bypasses env schema validation
**File:** [`packages/api/src/workers/anchor-passport.worker.ts:116, 139`](packages/api/src/workers/anchor-passport.worker.ts#L116)  
Read via `process.env['DEPLOYER_PRIVATE_KEY']` directly, bypassing the Zod-validated `env` object. Add it to `packages/api/src/env.ts` with appropriate validation.

---

### 19. `ThorClient` instantiated per job — should be a module singleton
**File:** [`packages/api/src/workers/anchor-passport.worker.ts:27-29`](packages/api/src/workers/anchor-passport.worker.ts#L27-L29)  
`getThorClient()` creates a new client instance on every anchor job. Move to a module-level constant created once at worker startup.

---

### 20. No alerting when anchor jobs are exhausted
**File:** [`packages/api/src/workers/anchor-passport.worker.ts:210-215`](packages/api/src/workers/anchor-passport.worker.ts#L210-L215)  
After 5 retries, only a pino log is emitted. Passports sit in `blockchainTxHash = null` state indefinitely with no operator notification. Add a webhook call or BullMQ monitoring hook in the `worker.on('failed')` handler.

---

### 21. Verify endpoint checks DB flag, not onchain state
**File:** `packages/api/src/modules/passport/passport.service.ts`  
`verifyPassport()` returns `verified: blockchainTxHash !== null` — a DB flag that can be spoofed by a direct DB write. Add an optional onchain read via `MaterialRegistry.verifyPassport()` and surface it as `onchainVerified: boolean | null`.

---

### 22. Missing `emailVerifiedAt` column on users table
**File:** [`packages/db/drizzle/schema.ts:39-52`](packages/db/drizzle/schema.ts#L39-L52)  
No column to track email verification. Add `emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true })` and include it in the initial migration.

---

### 23. Eight pages use `useEffect + fetch` instead of TanStack Query
**Files:** `passports/page.tsx`, `dashboard/page.tsx`, `passports/[id]/page.tsx`, `listings/page.tsx`, `quality/page.tsx`, `transactions/page.tsx`, `marketplace/page.tsx`, `marketplace/[id]/page.tsx`  
No request caching, no deduplication, no automatic retry. Migrate all to TanStack Query (`useQuery`).

---

### 24. No per-test database isolation
**File:** `packages/api/src/test-utils.ts`  
Tests use a shared seeded DB with no `beforeEach` cleanup, relying on `Date.now()` email workarounds to avoid conflicts. Wrap each test in a DB transaction that rolls back in `afterEach`, or truncate relevant tables.

---

### 25. No Fastify `schema.response` definitions
All route files — No OpenAPI response schemas registered with Fastify. Add `zodToJsonSchema` response definitions to enable runtime response validation and auto-generated API docs.

---

### 26. `offerPencE` typo in listing schema
**File:** [`packages/core/src/validators/listing.schema.ts:32`](packages/core/src/validators/listing.schema.ts#L32)  
Field named `offerPencE` (capital E). Rename to `offerPence` and update all callsites.

---

### 27. Unbounded eager relation loads in `findMany`
**Files:** `marketplace.service.ts:221`, `quality.service.ts:72`, `access-request.service.ts:192`  
`findMany` with `with: { ... }` loads 1:many relations without limits. Add pagination or explicit limits to prevent OOM on large datasets.

---

### 28. Unnecessary `'use client'` on `Label` component
**File:** [`packages/web/src/components/ui/label.tsx`](packages/web/src/components/ui/label.tsx)  
Purely presentational — uses Radix UI label primitive, no browser APIs needed. Remove the directive to keep the component as a server component.

---

### 29. No static analysis config for contracts
**Path:** `packages/contracts/`  
Add `.solhintrc.json` and `slither.config.json` to enforce Solidity lint rules and enable automated vulnerability scanning in CI.

---

### 30. No access-request reapply endpoint
After rejection, users have no mechanism to resubmit. Add a reapply path that creates a new `pending` row when the user's latest request is `rejected`, while blocking a new submission if one is already `pending`.

---

## Files to Modify

| File | Tier | Changes |
|------|------|---------|
| [`packages/contracts/contracts/CircularMarketplace.sol`](packages/contracts/contracts/CircularMarketplace.sol) | 1 + 2 | Fix `cancelTransaction` (restore mapping), add deadline to `flagDispute`, `resolveDispute` outcome param, duplicate `txId` check |
| [`packages/contracts/contracts/QualityAssurance.sol`](packages/contracts/contracts/QualityAssurance.sol) | 2 + 3 | Add custom errors, zero-address constructor check, make mappings private, underflow guard |
| [`packages/contracts/contracts/MaterialRegistry.sol`](packages/contracts/contracts/MaterialRegistry.sol) | 2 | Custom error + `MAX_BATCH_SIZE` for batch function |
| [`packages/api/src/workers/anchor-passport.worker.ts`](packages/api/src/workers/anchor-passport.worker.ts) | 1 + 3 | Fix VeChain signing, sort JSON-LD keys, singleton ThorClient, validated env for private key |
| [`packages/core/src/validators/auth.schema.ts`](packages/core/src/validators/auth.schema.ts) | 2 | `LoginSchema` password `.min(8)` |
| [`packages/web/src/lib/auth.ts`](packages/web/src/lib/auth.ts) | 2 | Migrate from `localStorage` to `httpOnly` cookie |
| [`packages/db/drizzle/schema.ts`](packages/db/drizzle/schema.ts) | 2 + 3 | Add `emailVerifiedAt` column |
| [`packages/contracts/package.json`](packages/contracts/package.json) | 1 | Fix `hardhat` / `hardhat-ethers` version mismatch |
| [`packages/core/src/validators/listing.schema.ts`](packages/core/src/validators/listing.schema.ts) | 3 | Rename `offerPencE` → `offerPence` |
| [`packages/contracts/test/CircularMarketplace.test.ts`](packages/contracts/test/CircularMarketplace.test.ts) | 2 | Create — full coverage including new deadline/outcome tests |
| [`packages/contracts/test/QualityAssurance.test.ts`](packages/contracts/test/QualityAssurance.test.ts) | 2 | Create — full coverage including custom error tests |
| [`packages/api/src/modules/passport/passport.test.ts`](packages/api/src/modules/passport/passport.test.ts) | 2 | Create |
| [`packages/api/src/modules/marketplace/marketplace.test.ts`](packages/api/src/modules/marketplace/marketplace.test.ts) | 2 | Create |
| [`packages/api/src/modules/quality/quality.test.ts`](packages/api/src/modules/quality/quality.test.ts) | 2 | Create |
| [`packages/contracts/.solhintrc.json`](packages/contracts/.solhintrc.json) | 3 | Create |

---

## Verification Checklist

```bash
# 1. Contracts build cleanly
pnpm --filter @trace/contracts build

# 2. All contract tests pass (requires Thor Solo running)
docker compose up -d thor-solo
pnpm --filter @trace/contracts test

# 3. All API tests pass
pnpm --filter @trace/api test

# 4. Generate and commit migration baseline
pnpm --filter @trace/db generate
# review the generated migration file, then:
pnpm --filter @trace/db migrate

# 5. End-to-end anchor flow verification
# POST /api/v1/passports with a valid payload
# Wait ~30s for anchor worker to process
# GET /api/v1/passports/:id  →  blockchainAnchoredAt should be non-null
# GET /api/v1/passports/:id/verify  →  onchainVerified should be true
```
