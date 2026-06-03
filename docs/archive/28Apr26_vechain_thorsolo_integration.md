# VeChain Thor Solo Integration

_Last updated: 28 Apr 2026_

---

## Contents

1. [Background and decisions](#1-background-and-decisions)
2. [How the system works](#2-how-the-system-works)
3. [Current deployment state](#3-current-deployment-state)
4. [Using and testing the system](#4-using-and-testing-the-system)
5. [Resetting Thor Solo](#5-resetting-thor-solo)
6. [Caveats and known gotchas](#6-caveats-and-known-gotchas)
7. [Key files reference](#7-key-files-reference)

---

## 1. Background and decisions

### Why VeChain?

TRACE uses VeChainThor for material passport anchoring. VeChain was chosen over Ethereum L2s for three specific reasons relevant to this use case:

- **Fee delegation**: the API pays VTHO on behalf of all user operations — users never need a wallet or any knowledge of blockchain
- **Multi-clause transactions**: multiple contract operations can be batched in a single transaction
- **Sustainability positioning**: aligns with the circular economy mission

### Why Thor Solo on staging?

Production will use VeChain testnet (`testnet.veblocks.net`). Staging uses a local Thor Solo container. The reasons:

- **Speed**: Solo with `--on-demand` creates blocks instantly. Testnet blocks take ~10s, making anchoring take 30–60s per passport. On Solo, anchoring is < 1s.
- **Isolation**: Solo tests the code, not VeChain's network. A testnet outage cannot block staging.
- **No VTHO management**: Solo genesis accounts have unlimited VTHO. No faucet, no wallet rotation.
- **Determinism**: Solo state can be wiped and reseeded with a single script.

### Why a custom genesis?

The default Thor Solo devnet genesis funds certain hardcoded addresses. The private keys for those addresses are embedded in the Thor binary and are not publicly documented — they cannot be extracted without reverse-engineering the binary (attempted; unsuccessful). Rather than compromise on the "never use the Hardhat default key" decision, we created a custom `genesis.json` that funds our own randomly generated deployer address directly.

This genesis file is committed to the repository. It is **not a secret** — it only defines the initial on-chain state (which address has VTHO). The `DEPLOYER_PRIVATE_KEY` that controls that address is in `.env` and is gitignored.

### What changed in this integration sprint

| Area | Change | Why |
|---|---|---|
| `Dockerfile.api` | Removed `--env-file=../../.env` from CMD | Old CMD baked `.env` into the image via `COPY . .`; Compose `env_file:` is the correct mechanism |
| `.dockerignore` | Added; excludes `.env`, `node_modules`, `.git` | Prevents secrets and large dirs from entering the build context |
| `docker-compose.yml` | Thor Solo now passes `--genesis genesis.json` | Funds our deployer address at genesis |
| `genesis.json` | New; funds deployer with 100k VET + 100k VTHO | Enables contract deployment and tx signing without relying on undocumented keys |
| `anchor-passport.worker.ts` | Hard fail on missing config (was silent skip); immediate first poll; gas set to 500k | Silent skip masked misconfiguration; 0 gas caused every tx to revert; immediate poll is near-instant on Solo |
| `deploy.ts` | Deploys all 3 contracts (was only MaterialRegistry) | CircularMarketplace and QualityAssurance were missing from the script |
| `hardhat.config.ts` | Added `dotenv` to load root `.env`; removed Hardhat default key fallback | Symlink approach replaced; prevents accidental use of the well-known public key |
| `package.json` (contracts) | Replaced `hardhat-toolbox@5` with individual packages | Toolbox v5 depends on `hardhat-ethers@4` which requires Hardhat 3; project is on Hardhat 2 |
| Root `package.json` | Added `pnpm.overrides` to pin `hardhat-ethers` to 3.1.3 | Prevents peer dep resolution from pulling v4 back in |
| `passport.service.ts` | Fixed `VERIFY_FUNCTION` ABI to use JSON format with full tuple return | Human-readable ABI with named tuple fields was rejected by abitype; the function returns `(bool, PassportRecord)` not just `(bool)` |

---

## 2. How the system works

### Architecture overview

```
User → API (Fastify) → PostgreSQL   (passport data)
                     → Redis/BullMQ  (anchor job queue)
                     → MinIO         (QR codes, assets)

Background:
  BullMQ Worker → Thor Solo (VeChain) → MaterialRegistry contract
                                      → Receipt confirmed → DB updated
```

The user never touches the blockchain directly. All signing and submission happens server-side.

### Passport anchoring flow

```
POST /api/v1/passports
  │
  ├─ Validate input
  ├─ Write passport to PostgreSQL
  ├─ Generate QR code → MinIO
  ├─ Enqueue BullMQ job: { passportId }
  └─ Return 201 with passport data

[Background — anchor-passport worker]
  │
  ├─ Load passport from DB
  ├─ Build canonical JSON-LD (keys sorted for reproducible hash)
  ├─ keccak256(JSON-LD) → dataHash
  ├─ Encode registerPassport(passportId, dataHash, metadataUri)
  ├─ Build VeChain transaction body (gas: 500,000)
  ├─ Sign with DEPLOYER_PRIVATE_KEY
  ├─ Submit to thor-solo:8669/transactions
  ├─ Poll for receipt (immediate first attempt, then every 5s, up to 60s)
  ├─ On confirmation: update DB with blockchainTxHash, blockchainPassportHash, blockchainAnchoredAt
  └─ On revert/timeout: throw → BullMQ retries
```

### On-chain verification flow

```
GET /api/v1/passports/:id/verify
  │
  ├─ Load passport from DB (includes blockchainTxHash, blockchainPassportHash)
  ├─ verified = (blockchainTxHash != null && blockchainAnchoredAt != null)
  ├─ If MATERIAL_REGISTRY_ADDRESS set AND blockchainPassportHash set:
  │    └─ Call MaterialRegistry.verifyPassport(passportId, storedHash) via ThorClient
  │         → returns (bool valid, PassportRecord record)
  │         → valid == true confirms hash on-chain matches DB
  └─ Return { verified, onchainVerified, ...passport }
```

`verified` = anchoring attempted and confirmed in DB.
`onchainVerified` = real-time read from the contract confirming the hash hasn't been tampered with.

### Contracts deployed

| Contract | Address (staging Solo) | Purpose |
|---|---|---|
| `MaterialRegistry` | `0xb7ed275e1aa9c31cf06d58876759c3a45f1546a1` | Passport hash anchoring and verification |
| `CircularMarketplace` | `0x9946a615fb16c03edbe7558205056cfab5a9f525` | On-chain listing and transaction state |
| `QualityAssurance` | `0x139187edf9cf9d8c671110b0994cb41d7371c434` | Inspection report anchoring |

Deployed at `2026-04-27T19:23:53Z` by `0xE2F62A5f55c4707669dF015cA3A5d2aD29172dfF`.

---

## 3. Current deployment state

### Thor Solo

- **Image**: `vechain/thor:latest` (v2.4.3)
- **Mode**: `solo --on-demand --persist`
- **Genesis**: custom (`genesis.json` committed at repo root)
- **Genesis ID**: `0x00000000af64721df7fb9195208d18bc82eec592a3bf38b3a0894c5b390a56a3`
- **Chain tag** (last byte of genesis ID): `0xa3` = `163`
- **Internal URL** (Docker network): `http://thor-solo:8669`
- **External URL** (host machine): `http://localhost:8670`
- **Authority signer**: `0xf077b491b355e64048ce21e3a6fc4751eeea77fa` (Thor Solo's internal master key — signs blocks, not our deployer)

### Deployer wallet

- **Address**: `0xE2F62A5f55c4707669dF015cA3A5d2aD29172dfF`
- **Key**: `DEPLOYER_PRIVATE_KEY` in root `.env` (gitignored)
- **Balance on genesis**: 100,000 VET + 100,000 VTHO (sufficient for thousands of contract calls)
- **Role on MaterialRegistry**: `HUB_ROLE` (granted in deploy script)

### Environment variables relevant to blockchain

```env
VECHAIN_NODE_URL=http://thor-solo:8669      # Docker internal — used by API container
DEPLOYER_PRIVATE_KEY=0x...                  # In .env (gitignored)
MATERIAL_REGISTRY_ADDRESS=0xb7ed275e1aa9c31cf06d58876759c3a45f1546a1
MARKETPLACE_ADDRESS=0x9946a615fb16c03edbe7558205056cfab5a9f525
QUALITY_ASSURANCE_ADDRESS=0x139187edf9cf9d8c671110b0994cb41d7371c434
FEE_DELEGATOR_URL=                          # Empty for staging (not needed on Solo)
```

---

## 4. Using and testing the system

### Prerequisites

All services must be running:

```bash
docker compose ps
# Should show: api, postgres, redis, thor-solo, minio, meilisearch (web optional)
```

If any are stopped:

```bash
docker compose up -d
```

### Quick smoke test — full anchor loop

```bash
# 1. Get an auth token (hub_staff role can create passports)
TOKEN=$(curl -s -X POST http://localhost:4004/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@stirlingreuse.com","password":"Staff1234!"}' \
  | jq -r '.data.token')

# 2. Create a passport
PASSPORT_ID=$(curl -s -X POST http://localhost:4004/api/v1/passports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Test Brick",
    "categoryL1": "masonry",
    "materialComposition": [{"material": "clay", "percentage": 100}],
    "ceMarking": false,
    "hazardousSubstances": [],
    "conditionGrade": "B"
  }' | jq -r '.data.id')

echo "Created passport: $PASSPORT_ID"

# 3. Wait a few seconds (Solo is near-instant; allow ~5s for job processing)
sleep 8

# 4. Check anchoring on the main endpoint (DB fields only)
curl -s "http://localhost:4004/api/v1/passports/$PASSPORT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    blockchainTxHash: .data.blockchainTxHash,
    blockchainAnchoredAt: .data.blockchainAnchoredAt
  }'

# 5. Full on-chain verification (calls the contract)
curl -s "http://localhost:4004/api/v1/passports/$PASSPORT_ID/verify" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    verified: .data.verified,
    onchainVerified: .data.onchainVerified,
    blockchainTxHash: .data.blockchainTxHash
  }'
```

**Expected result:**
```json
{
  "verified": true,
  "onchainVerified": true,
  "blockchainTxHash": "0x..."
}
```

### Inspecting a transaction on Thor Solo

Thor Solo exposes a REST API at `http://localhost:8670`.

```bash
# Get a transaction by ID
TX="0x27ea0a50f7cf23630bf3f2e83fad855de896cb9fcf936a313dc6fff312272da8"
curl -s "http://localhost:8670/transactions/$TX" | jq '{id, origin, clauses}'

# Get a transaction receipt
curl -s "http://localhost:8670/transactions/$TX/receipt" | jq '{gasUsed, reverted, meta}'

# Check the deployer's current VTHO balance
curl -s "http://localhost:8670/accounts/0xE2F62A5f55c4707669dF015cA3A5d2aD29172dfF" \
  | jq '{balance: (.balance | ltrimstr("0x") | tonumber), energy: (.energy | ltrimstr("0x") | tonumber)}'

# Check the current best block
curl -s "http://localhost:8670/blocks/best" | jq '{number, id, signer}'
```

### Calling the contract directly

To call `MaterialRegistry.verifyPassport()` directly from the CLI:

```bash
# Replace PASSPORT_ID and DATA_HASH with real values from the DB
node -e "
const { ethers } = require('./packages/contracts/node_modules/ethers');
const iface = new ethers.Interface([
  'function verifyPassport(bytes32 passportId, bytes32 dataHash) view returns (bool valid, tuple(bytes32,address,uint8,uint64,uint64,string) record)'
]);
const passportId = '0x' + '<uuid-without-dashes>'.padStart(64, '0');
const dataHash = '<blockchain_passport_hash from DB>';
const data = iface.encodeFunctionData('verifyPassport', [passportId, dataHash]);
console.log('calldata:', data);
"
# Then simulate:
curl -s -X POST 'http://localhost:8670/accounts/*' \
  -H 'Content-Type: application/json' \
  -d "{\"clauses\":[{\"to\":\"0xb7ed275e1aa9c31cf06d58876759c3a45f1546a1\",\"value\":\"0x0\",\"data\":\"<calldata>\"}],\"gas\":50000}" \
  | jq '.[0] | {reverted, gasUsed, data}'
```

### Deploying contracts after a Solo reset

After running `./scripts/reset-solo.sh`:

```bash
# Deploy all three contracts
VECHAIN_NODE_URL=http://localhost:8670 pnpm --filter @trace/contracts deploy:solo
```

The deploy script prints the new addresses and writes `packages/contracts/deployments.json`. Update `.env` with the printed addresses, then restart the API:

```bash
# Edit .env with the new addresses, then:
docker compose restart api
```

### Running contract tests

```bash
# Requires Thor Solo to be running (docker compose up -d thor-solo)
# Uses VECHAIN_NODE_URL from root .env or overrides
VECHAIN_NODE_URL=http://localhost:8670 pnpm --filter @trace/contracts test
```

---

## 5. Resetting Thor Solo

Use this when you need a clean chain: corrupted state, major contract changes, or a known-good baseline.

```bash
./scripts/reset-solo.sh
```

This script:
1. Stops the `thor-solo` container
2. Removes it
3. Deletes the `trace-staging_thor-data` Docker volume
4. Starts a fresh `thor-solo` using the custom `genesis.json`

**After the reset, the deployer address is funded again but contracts no longer exist.** Redeploy:

```bash
VECHAIN_NODE_URL=http://localhost:8670 pnpm --filter @trace/contracts deploy:solo
# Copy the 3 printed addresses into .env, then:
docker compose restart api
```

### What the custom genesis provides

The `genesis.json` at the repo root configures the initial chain state:

- Funds `0xE2F62A5f55c4707669dF015cA3A5d2aD29172dfF` with 100,000 VET + 100,000 VTHO
- Sets the deployer as the authority node candidate (required by Thor; not the actual block signer — Thor uses its own internal key for that)
- Enables all VeChain protocol forks from block 0 (VIP191, GALACTICA, HAYABUSA, etc.)

The genesis file is committed to git. It is safe to commit because it only defines initial on-chain state — no private keys.

---

## 6. Caveats and known gotchas

### The block signer vs the deployer

Thor Solo always signs blocks with its own internal master key (`0xf077b491...`). Our deployer address (`0xE2F62A5f...`) is set as the authority candidate in `genesis.json` but this is required by the genesis format — it does not mean our deployer signs blocks. Blocks are always signed by Thor's internal key regardless of what the genesis says about authority candidates.

This is harmless. The deployer just needs VTHO, which the genesis provides.

### Transaction type 81 (HAYABUSA / EIP-1559 style)

The custom genesis enables the HAYABUSA fork at block 0. VeChain SDK 1.2.x defaults to sending type-81 (dynamic fee) transactions on chains with HAYABUSA enabled. The gas calculation for these transactions is slightly different — the `gas` field in `buildTransactionBody()` must be set high enough to cover both intrinsic gas and EVM execution.

**The anchor worker uses `gas: 500_000`** — well above the ~200k actually consumed by `registerPassport`. The actual VTHO cost per anchor is approximately 0.2 VTHO at the base gas price.

If you ever see `tx rejected: intrinsic gas exceeds provided gas`, the gas limit is too low. Increase it.

### `VECHAIN_NODE_URL` is Docker-internal

The `.env` has `VECHAIN_NODE_URL=http://thor-solo:8669`. This hostname only resolves inside the Docker network (i.e., from the API container). If you run anything from the host machine (deploy scripts, tests, direct SDK calls), you must override it:

```bash
VECHAIN_NODE_URL=http://localhost:8670 pnpm --filter @trace/contracts deploy:solo
```

The deploy and test scripts read from environment variables, so the override works without changing any files.

### `verified` vs `onchainVerified`

There are two verification fields, used by two different endpoints:

| Field | Endpoint | What it means |
|---|---|---|
| `verified` | `GET /api/v1/passports/:id` | `true` if `blockchainTxHash` and `blockchainAnchoredAt` are non-null in DB. Does **not** hit the chain. |
| `onchainVerified` | `GET /api/v1/passports/:id/verify` | Real-time call to `MaterialRegistry.verifyPassport()` on-chain. Confirms the stored hash matches what was registered. `null` if contract unreachable. |

The `/verify` endpoint is the authoritative one. The main GET is fast (DB-only) and suitable for list views.

### Docker image must be rebuilt after code changes

`docker compose restart api` restarts the existing container without rebuilding. If you modify TypeScript source files, you must rebuild:

```bash
docker compose build api && docker compose up -d api
```

The `.dockerignore` excludes `.env`, `node_modules`, and `.git` from the build context. The root `.env` is never baked into the image — all env vars reach the container via Compose's `env_file: .env` mechanism.

### BullMQ retries on anchor failure

The anchor worker throws on misconfiguration or transaction failure. BullMQ retries the job with exponential backoff. Check failed jobs:

```bash
# View anchor worker logs
docker compose logs api --follow | grep -E "anchor|error|Error"
```

If a passport is stuck in a retry loop, it usually means:
1. `MATERIAL_REGISTRY_ADDRESS` or `DEPLOYER_PRIVATE_KEY` is not set in `.env` → check env vars, restart API
2. The contract was redeployed (Solo reset) but `.env` wasn't updated → redeploy contracts, update `.env`, restart API
3. The transaction reverted → check the receipt on `http://localhost:8670/transactions/<txHash>/receipt`

### hardhat-toolbox removed

The contracts package no longer uses `@nomicfoundation/hardhat-toolbox`. It was replaced with explicit individual packages because toolbox v5 pulls in `hardhat-ethers@4.x`, which requires Hardhat 3, while this project uses Hardhat 2.x. A `pnpm.overrides` in the root `package.json` pins `@nomicfoundation/hardhat-ethers` to `3.1.3` across the workspace to prevent peer dependency resolution from pulling v4 back in.

If you add a new Hardhat plugin, check whether it requires `hardhat-ethers@4.x` before installing.

### Fee delegation (not yet wired)

`FEE_DELEGATOR_URL` is parsed by `env.ts` but not yet used in the anchor worker. When wired, it will allow a third-party delegator service to pay VTHO on behalf of the deployer. For staging Solo this isn't needed — the genesis funds the deployer directly. For production testnet, the VeChain Foundation offers a free delegation service.

---

## 7. Key files reference

| File | Purpose |
|---|---|
| [`genesis.json`](genesis.json) | Custom Solo genesis — funds deployer, enables all forks |
| [`docker-compose.yml`](docker-compose.yml) | Thor Solo service config — mounts `genesis.json`, maps port 8669→8670 |
| [`scripts/reset-solo.sh`](scripts/reset-solo.sh) | Wipe Solo state and restart with clean chain |
| [`packages/contracts/hardhat.config.ts`](packages/contracts/hardhat.config.ts) | Hardhat network config — loads `.env` via dotenv, both Solo and testnet |
| [`packages/contracts/scripts/deploy.ts`](packages/contracts/scripts/deploy.ts) | Deploy all 3 contracts, print addresses, write `deployments.json` |
| [`packages/contracts/deployments.json`](packages/contracts/deployments.json) | Last deploy output (gitignored — local reference only) |
| [`packages/api/src/workers/anchor-passport.worker.ts`](packages/api/src/workers/anchor-passport.worker.ts) | BullMQ worker — computes hash, signs tx, polls receipt, updates DB |
| [`packages/api/src/modules/passport/passport.service.ts`](packages/api/src/modules/passport/passport.service.ts) | `verifyPassport()` — on-chain read via ThorClient |
| [`packages/api/src/env.ts`](packages/api/src/env.ts) | Env var validation — all blockchain-related vars |
| [`Dockerfile.api`](Dockerfile.api) | API container — env vars from Compose only, no file loading in CMD |
| [`.dockerignore`](.dockerignore) | Excludes `.env`, `node_modules`, `.git` from build context |
| [`.env.example`](.env.example) | Canonical variable reference — all keys with comments |
| [`27Apr26_TRACE_blockchain_environment_strat.md`](27Apr26_TRACE_blockchain_environment_strat.md) | Architecture decisions and environment topology |
