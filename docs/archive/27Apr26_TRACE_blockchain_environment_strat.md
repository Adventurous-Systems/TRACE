# TRACE Blockchain Environment Strategy

_Date: 27 Apr 2026 (revised from 22 Apr 2026)_

---

## Context

TRACE has two servers (staging and production) and needs a clear development flow:
- Features are developed and tested on **staging**
- Once stable, they are promoted to **production**
- The agreed direction: production will use **VeChain testnet** (users never touch crypto; the API handles everything server-side)

---

## Environment Topology

| Layer | Blockchain | Node | Contract addresses | VTHO |
|---|---|---|---|---|
| Local dev | Thor Solo (Docker) | Bundled in compose | Local deploy, output by deploy script | Genesis accounts (unlimited) |
| Staging server | Thor Solo (Docker) | Bundled in compose | Staging deploy, env vars on server | Genesis accounts (unlimited) |
| Production server | VeChain testnet | `testnet.veblocks.net` (public) | Testnet deploy, env vars on server | Testnet faucet VTHO |

---

## Recommended Architecture

### Production → VeChain Testnet (public endpoint)

- `VECHAIN_NODE_URL=https://testnet.veblocks.net`
- Contracts deployed to testnet, addresses stored as env vars
- Uses testnet VTHO (free from VeChain faucet) — no real money involved
- All user-facing transactions go through the API; users never touch crypto directly
- Fee delegation (`FEE_DELEGATOR_URL`) handles VTHO on behalf of users — wire up the VeChain Foundation's free testnet delegator before going live

**On running your own VeChain node:** Not needed yet. The public testnet endpoint is maintained by the VeChain Foundation and reliable. Only add a dedicated node if rate limiting or uptime becomes an issue.

---

### Staging → Local Thor Solo (Docker container)

Keep staging on Thor Solo with `--on-demand`. Reasoning:

1. **Speed**: `--on-demand` creates blocks instantly. VeChain testnet blocks take ~10s.
2. **Isolation**: Staging tests your code, not VeChain's network. A testnet outage should never block staging.
3. **No VTHO management**: Solo genesis accounts have unlimited VTHO. No faucet, no wallet management.
4. **Determinism**: Solo state can be wiped and reseeded cleanly. See `scripts/reset-solo.sh`.

---

## Fee Delegation

Fee delegation lets the API pay VTHO on behalf of all user operations — users never need a wallet.

`FEE_DELEGATOR_URL` is parsed in `packages/api/src/env.ts` and will be wired into the anchor worker.

**Sequencing:**
1. Get the core anchor loop working and verified end-to-end first
2. Then wire delegation into `anchor-passport.worker.ts`
3. Set `FEE_DELEGATOR_URL` to the VeChain Foundation's free testnet delegator for production

Leave `FEE_DELEGATOR_URL` empty in staging — Solo genesis accounts cover VTHO directly.

---

## Environment Variable Management

**Single source of truth: root `.env`**

```
/opt/TRACE-staging/
├── .env              ← single file with all values (gitignored, per-server)
└── .env.example      ← committed, all keys documented, no secrets
```

**How each context loads env vars:**

| Context | Mechanism |
|---|---|
| API (Docker) | `env_file: .env` in `docker-compose.yml` injects vars into the container |
| API (local dev) | `tsx watch --env-file=../../.env src/index.ts` in `package.json` dev script |
| Hardhat / contracts | `dotenv({ path: '../../.env' })` at the top of `hardhat.config.ts` |

**No symlinks needed.** The previous strategy proposed `ln -sf ../../.env packages/api/.env` and `ln -sf ../../.env packages/contracts/.env` — neither is required. The API dev script loads the root `.env` by explicit path; Hardhat does the same via dotenv.

**Per-environment `.env` differences:**

| Variable | Staging | Production |
|---|---|---|
| `VECHAIN_NODE_URL` | `http://thor-solo:8669` | `https://testnet.veblocks.net` |
| `DEPLOYER_PRIVATE_KEY` | Randomly generated key (not the Hardhat default) | Dedicated testnet wallet |
| `MATERIAL_REGISTRY_ADDRESS` | Staging Solo deploy address | Testnet deploy address |
| `MARKETPLACE_ADDRESS` | Staging Solo deploy address | Testnet deploy address |
| `QUALITY_ASSURANCE_ADDRESS` | Staging Solo deploy address | Testnet deploy address |
| `FEE_DELEGATOR_URL` | _(empty)_ | VeChain Foundation testnet delegator |
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` |

---

## Deployment Workflow

### New feature / contract change

1. **Develop locally** with Thor Solo
   ```bash
   docker compose up -d
   pnpm --filter @trace/contracts deploy:solo
   # develop and test against local Solo
   ```

2. **Push to staging**
   - Manual: SSH to staging, redeploy contracts if changed, update staging `.env` with new addresses, restart API
   - See staging server setup checklist below

3. **Promote to production** (manual gate)
   ```bash
   pnpm --filter @trace/contracts deploy:testnet
   # update production .env with new contract addresses
   # restart production API
   ```

### Key rule
**Contracts are deployed separately per environment.** Staging and production always have different contract addresses. Never share contract instances between environments.

---

## Resetting Thor Solo State

When you need a clean chain (corrupted state, major contract rewrite, fresh test slate):

```bash
./scripts/reset-solo.sh
```

This stops the container, removes the `thor-data` volume, and restarts with a clean genesis. After running it, redeploy contracts and update `.env` with the new addresses.

---

## `deployments.json`

The deploy script writes a `deployments.json` file at `packages/contracts/deployments.json` after each deploy. This file is gitignored — it's a local convenience to inspect what was last deployed without scrolling terminal history. Nothing in the codebase reads it; env vars are the source of truth.

---

## Staging Server Setup Checklist

- [ ] Generate a fresh deployer key: `openssl rand -hex 32` → prefix `0x` → set as `DEPLOYER_PRIVATE_KEY` in root `.env`
  - **Never use the Hardhat default key** (`0x99f0500...`) — it is publicly known and controls any contracts it deploys permanently
- [ ] Set all other required vars in root `.env` (see `.env.example`)
- [ ] Run `pnpm --filter @trace/contracts deploy:solo`
- [ ] Copy `MATERIAL_REGISTRY_ADDRESS`, `MARKETPLACE_ADDRESS`, `QUALITY_ASSURANCE_ADDRESS` from deploy output into `.env`
- [ ] Restart API: `docker compose restart api`
- [ ] Verify loop: `POST /api/v1/passports` → wait → `GET /api/v1/passports/:id` → confirm `blockchainTxHash` populated

### Production server
- [ ] Generate a dedicated deployer wallet: `openssl rand -hex 32` → prefix `0x`
- [ ] Fund it with testnet VTHO from the VeChain faucet
- [ ] Set `VECHAIN_NODE_URL=https://testnet.veblocks.net` and `DEPLOYER_PRIVATE_KEY` in production `.env`
- [ ] Run `pnpm --filter @trace/contracts deploy:testnet`
- [ ] Copy contract addresses into production `.env`
- [ ] Set `FEE_DELEGATOR_URL` to VeChain Foundation testnet delegator before users go live

---

## Verification

To verify the full loop on either environment:
1. `POST /api/v1/passports` — creates a passport, queues anchoring job
2. Wait for anchoring (Solo: near-instant; testnet: ~30–60s for block confirmation)
3. `GET /api/v1/passports/:id` — confirm `blockchainTxHash`, `blockchainAnchoredAt` are populated
4. Cross-check on-chain by calling `MaterialRegistry.verifyPassport()` directly via the VeChain explorer or SDK

---

## Key Files

| File | Purpose |
|---|---|
| [packages/contracts/hardhat.config.ts](packages/contracts/hardhat.config.ts) | Network config — Solo and testnet endpoints; loads `.env` via dotenv |
| [packages/contracts/scripts/deploy.ts](packages/contracts/scripts/deploy.ts) | Deploy script — deploys MaterialRegistry, CircularMarketplace, QualityAssurance |
| [packages/api/src/env.ts](packages/api/src/env.ts) | Env var validation — VECHAIN_NODE_URL, contract addresses |
| [packages/api/src/workers/anchor-passport.worker.ts](packages/api/src/workers/anchor-passport.worker.ts) | Blockchain anchoring worker — hard fails on missing config |
| [docker-compose.yml](docker-compose.yml) | Thor Solo container config; injects `.env` via `env_file:` |
| [scripts/reset-solo.sh](scripts/reset-solo.sh) | Wipes Solo state and restarts with clean chain |
| [Dockerfile.api](Dockerfile.api) | API container — env vars come from Compose, not baked in |
| [.env.example](.env.example) | Canonical variable reference — keep this up to date |
