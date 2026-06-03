# EthSkills Sweep — Fixes & Enhancements Plan
**Date:** 2026-04-15  
**Source:** Applied [EthSkills](https://ethskills.com) guidance (security, audit, testing, concepts) against the TRACE codebase.

---

## Summary

Three smart contracts (MaterialRegistry, QualityAssurance, CircularMarketplace), a BullMQ anchor worker, and the Fastify API were audited. **11 issues** were found across all layers — including 3 critical bugs that would cause silent data corruption or broken blockchain anchoring in production.

---

## Critical Bugs

### 1. `cancelTransaction` breaks `_passportListing` mapping
**File:** [`packages/contracts/contracts/CircularMarketplace.sol:346-352`](packages/contracts/contracts/CircularMarketplace.sol#L346-L352)

When a transaction is cancelled the listing status is restored to `Active`, but `_passportListing[passportId]` is **not** restored. This means:
- `getPassportListing(passportId)` returns `bytes32(0)` after a cancel
- `createListing()` will succeed again for the same passport, while the old listing still exists — creating a ghost duplicate on the next listing attempt

**Fix:** Add one line in `cancelTransaction` after restoring the listing status:
```solidity
_passportListing[listing.passportId] = tx_.listingId;
```

---

### 2. `flagDispute` ignores `disputeDeadline`
**File:** [`packages/contracts/contracts/CircularMarketplace.sol:295-308`](packages/contracts/contracts/CircularMarketplace.sol#L295-L308)

The `disputeDeadline` timestamp is stored on every `MarketTx` but is **never checked** inside `flagDispute()`. Buyers can raise disputes indefinitely after the window has closed, undermining the settlement finality guarantee.

**Fix:** Add a new error and a deadline guard at the top of `flagDispute`:
```solidity
error DisputeWindowClosed(bytes32 txId);

// inside flagDispute(), before status check:
if (block.timestamp > tx_.disputeDeadline) revert DisputeWindowClosed(txId);
```

---

### 3. VeChain transaction signing is broken
**File:** [`packages/api/src/workers/anchor-passport.worker.ts:142-158`](packages/api/src/workers/anchor-passport.worker.ts#L142-L158)

The worker spreads a VeChain transaction body into `ethers.Wallet.signTransaction()`:
```typescript
const rawTx = await wallet.signTransaction({
  ...txBody,          // VeChain fields: clauses, chainTag, blockRef, gasPriceCoef…
  chainId: txBody.chainTag,  // chainTag is 1 byte; chainId is a full uint
} as Parameters<typeof wallet.signTransaction>[0]);
```

VeChain and Ethereum use **fundamentally different transaction wire formats**. `ethers.Wallet` produces an Ethereum RLP-encoded transaction; VeChain nodes will reject it outright. The anchor worker has never successfully submitted a transaction to a real VeChain node.

**Fix:** Replace ethers signing with VeChain SDK native signing:
```typescript
import { Transaction, secp256k1 } from '@vechain/sdk-core';

const privKeyHex = process.env['DEPLOYER_PRIVATE_KEY']!.replace(/^0x/, '');
const privKeyBuf = Buffer.from(privKeyHex, 'hex');

const tx = new Transaction(txBody);
tx.signature = secp256k1.sign(tx.signingHash(), privKeyBuf);
const rawTx = '0x' + tx.encode().toString('hex');

const { id: txId } = await thorClient.transactions.sendRawTransaction(rawTx);
```
Remove the `ethers` `Wallet` import; keep `keccak256` and `Interface` from ethers (those are fine for hashing and ABI encoding).

---

## High Issues — Smart Contracts

### 4. `require` string in `registerPassportBatch` (inconsistent + gas waste)
**File:** [`packages/contracts/contracts/MaterialRegistry.sol:146`](packages/contracts/contracts/MaterialRegistry.sol#L146)

```solidity
require(len == dataHashes.length && len == metadataUris.length, "Length mismatch");
```

Every other revert in MaterialRegistry uses a custom error. This `require` string costs extra gas and is inconsistent.

**Fix:**
```solidity
error ArrayLengthMismatch();
error BatchTooLarge(uint256 size);

uint256 public constant MAX_BATCH_SIZE = 100;

// replace the require:
if (len != dataHashes.length || len != metadataUris.length) revert ArrayLengthMismatch();
if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len);
```

The `MAX_BATCH_SIZE` cap prevents an unbounded loop from running out of gas for large inputs.

---

### 5. `QualityAssurance` uses `require` strings throughout
**File:** [`packages/contracts/contracts/QualityAssurance.sol:93-135`](packages/contracts/contracts/QualityAssurance.sol#L93-L135)

All three `require` calls use string messages, unlike the other two contracts which use custom errors.

**Fix:** Add custom errors and replace all `require` statements:
```solidity
error InvalidAddress();
error InspectorAlreadyRegistered(address inspector);
error ReportAlreadyAnchored(bytes32 reportId);
error EmptyHash();
error EmptyMaterialId();
error ReportNotFound(bytes32 reportId);
error ReportAlreadyDisputed(bytes32 reportId);

// registerInspector:
if (inspector == address(0)) revert InvalidAddress();

// anchorReport:
if (reports[reportId].exists) revert ReportAlreadyAnchored(reportId);
if (reportHash == bytes32(0)) revert EmptyHash();
if (materialId == bytes32(0)) revert EmptyMaterialId();

// flagDispute:
if (!reports[reportId].exists) revert ReportNotFound(reportId);
if (reports[reportId].disputed) revert ReportAlreadyDisputed(reportId);
```

---

### 6. `QualityAssurance` constructor missing zero-address check
**File:** [`packages/contracts/contracts/QualityAssurance.sol:77-80`](packages/contracts/contracts/QualityAssurance.sol#L77-L80)

Both `MaterialRegistry` and `CircularMarketplace` guard `address(0)` in their constructors. QA doesn't — a zero admin address would lock the contract permanently.

**Fix:**
```solidity
constructor(address admin) {
    if (admin == address(0)) revert InvalidAddress();
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ADMIN_ROLE, admin);
}
```

---

### 7. `reports` and `materialReports` unnecessarily `public`
**File:** [`packages/contracts/contracts/QualityAssurance.sol:49-54`](packages/contracts/contracts/QualityAssurance.sol#L49-L54)

The auto-generated getter for `materialReports` only exposes single-index access, not the full array. `getMaterialReports()` already provides full access. Public storage leaks struct layout and is unnecessary surface area.

**Fix:** Change both mappings to `private`:
```solidity
mapping(bytes32 => Report) private reports;
mapping(bytes32 => bytes32[]) private materialReports;
mapping(address => InspectorProfile) private inspectors;
```

---

### 8. `resolveDispute` has no outcome — always completes (seller always wins)
**File:** [`packages/contracts/contracts/CircularMarketplace.sol:313-326`](packages/contracts/contracts/CircularMarketplace.sol#L313-L326)

`resolveDispute()` always calls `_completeTx()` regardless of who was at fault. If admin rules in the buyer's favour there is no way to cancel the transaction on-chain.

**Fix:** Add an outcome parameter:
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

## Medium Issues — Worker & API

### 9. `buildCanonicalJsonLd` is not truly canonical
**File:** [`packages/api/src/workers/anchor-passport.worker.ts:38-78`](packages/api/src/workers/anchor-passport.worker.ts#L38-L78)

`JSON.stringify` preserves JS object literal insertion order. Any future field reordering in source code silently changes every hash, invalidating all prior anchors.

**Fix:** Sort keys before stringifying:
```typescript
const sorted = Object.fromEntries(
  Object.entries(doc).sort(([a], [b]) => a.localeCompare(b))
);
return JSON.stringify(sorted);
```

---

### 10. Verify endpoint checks DB flag, not onchain state
**File:** [`packages/api/src/modules/passport/passport.service.ts`](packages/api/src/modules/passport/passport.service.ts)

`verifyPassport()` returns `verified: passport.blockchainTxHash !== null`. This can be true even if the onchain record was tampered with or the anchor failed silently. The whole point of blockchain anchoring is verifiability.

**Fix:** When `MATERIAL_REGISTRY_ADDRESS` is set, call `MaterialRegistry.verifyPassport()` onchain and surface the result:
```typescript
// Additional field in verify response:
onchainVerified: boolean | null  // null if registry not configured
```
Use `thorClient.contracts.executeCall()` with the `verifyPassport(bytes32, bytes32)` ABI to read the onchain record.

---

### 11. Login schema password minimum too weak
**File:** [`packages/core/src/validators/auth.schema.ts`](packages/core/src/validators/auth.schema.ts)

`LoginSchema` uses `.min(1)` for the password field. `RegisterSchema` correctly uses `.min(8)`. Login should match to prevent submitting clearly invalid credentials and to align validation between endpoints.

**Fix:**
```typescript
// LoginSchema:
password: z.string().min(8),
```

---

## Files to Modify

| File | Changes |
|------|---------|
| [`packages/contracts/contracts/MaterialRegistry.sol`](packages/contracts/contracts/MaterialRegistry.sol) | Add `ArrayLengthMismatch`, `BatchTooLarge`, `MAX_BATCH_SIZE`; replace `require` in batch fn |
| [`packages/contracts/contracts/QualityAssurance.sol`](packages/contracts/contracts/QualityAssurance.sol) | Add custom errors; replace all `require`; add zero-address check in constructor; make mappings `private` |
| [`packages/contracts/contracts/CircularMarketplace.sol`](packages/contracts/contracts/CircularMarketplace.sol) | Fix `cancelTransaction` restoring `_passportListing`; add deadline guard in `flagDispute`; add outcome param to `resolveDispute` |
| [`packages/api/src/workers/anchor-passport.worker.ts`](packages/api/src/workers/anchor-passport.worker.ts) | Fix VeChain signing with `@vechain/sdk-core`; sort JSON-LD keys for canonical hash |
| [`packages/core/src/validators/auth.schema.ts`](packages/core/src/validators/auth.schema.ts) | Change login password to `.min(8)` |
| [`packages/api/src/modules/passport/passport.service.ts`](packages/api/src/modules/passport/passport.service.ts) | Add optional onchain `verifyPassport` call; surface `onchainVerified` in response |

---

## Verification

### Smart Contracts
```bash
pnpm --filter @trace/contracts test
```
Add new test cases for:
- `cancelTransaction` → `getPassportListing()` returns listingId (not zero) after cancel
- `flagDispute` → reverts with `DisputeWindowClosed` when called after `disputeDeadline`
- `resolveDispute(txId, false)` → tx cancelled, listing reactivated, `_passportListing` restored
- `registerPassportBatch` → reverts `ArrayLengthMismatch` and `BatchTooLarge` (>100 items)
- `QualityAssurance` custom errors → each new error type thrown correctly

### Anchor Worker (end-to-end)
```bash
docker compose up -d thor-solo
pnpm --filter @trace/contracts deploy:solo
pnpm --filter @trace/api dev
# POST /api/v1/passports with valid payload
# Wait ~30s, then GET /api/v1/passports/:id — blockchainAnchoredAt should be non-null
```

### API
```bash
pnpm --filter @trace/api test
# Manual: GET /api/v1/passports/:id/verify — response should include onchainVerified field
```
