# TRACE Beta Staging Post-Implementation Guide

_Date: 01 May 2026_

## Purpose

This document records what was implemented from `28Apr26_beta_staging_plan.md`, what changed in the product and codebase, how the new staging flow works, and how to operate and test it.

The main outcome is that beta users can create, verify, browse, and buy materials without touching wallets or VTHO. TRACE now manages org-level custodial wallets, fee delegation, blockchain certificate status, and durable audit/VTHO visibility behind the scenes.

## Executive Summary

Implemented:

- Org-level custodial VeChain wallets for hubs and organisations.
- Passport-only fee delegation support for anchoring.
- Durable audit logging for critical user, platform, and blockchain actions.
- Platform-admin "Activity & VTHO" visibility.
- Walletless buyer purchase/offering flow.
- Passport certificate endpoint and UI panel.
- TRACE Solo mini-explorer for local transaction inspection.
- Option B anchoring UX: real pending verification step with skeleton passport and pulsing badge.
- Updated beta staging plan with synthetic data removed and agreed decisions folded in.

Not implemented by design:

- Synthetic beta data or synthetic images.
- Marketplace smart-contract wiring.
- Quality report smart-contract wiring.
- User-facing wallets, per-user wallets, WalletConnect, NFTs, token gating, or cross-chain support.

## What Changed

### 1. Database Schema

New organisation wallet field:

- `organisations.blockchain_private_key_enc`

New audit table:

- `audit_events`

New blockchain transaction table:

- `blockchain_transactions`

New migrations:

- `packages/db/migrations/0002_wallets_audit_blockchain.sql`
- `packages/db/migrations/0003_audit_event_origin.sql`

The audit table records actor, role, email, organisation, action, resource, status, failure reason, origin, metadata, and timestamp.

The blockchain transaction table records transaction hash, action, resource, org, actor, origin address, gas payer, contract address, status, gas limit, gas used, VTHO paid, block number/id, failure reason, and timestamps.

### 2. Environment Variables

Added in `.env.example`:

```bash
WALLET_ENCRYPTION_KEY=
FEE_DELEGATOR_PRIVATE_KEY=0x
FEE_DELEGATION_REQUIRED=false
VTHO_WARNING_THRESHOLD_WEI=10000000000000000000
VTHO_CRITICAL_THRESHOLD_WEI=1000000000000000000
# NEXT_PUBLIC_VECHAIN_EXPLORER_URL=https://explore-testnet.vechain.org
```

Existing but now actively used:

```bash
FEE_DELEGATOR_URL=
DEPLOYER_PRIVATE_KEY=0x
MATERIAL_REGISTRY_ADDRESS=
VECHAIN_NODE_URL=http://localhost:8669
```

Important operating rule:

- Passport anchoring requires `WALLET_ENCRYPTION_KEY`.
- `DEPLOYER_PRIVATE_KEY` is still required to grant `HUB_ROLE` to new org wallets.
- Gas is paid by `FEE_DELEGATOR_URL` when set, otherwise `FEE_DELEGATOR_PRIVATE_KEY`, otherwise the deployer key in non-production as a local fallback.
- If `FEE_DELEGATION_REQUIRED=true`, anchoring fails unless a fee delegator URL or private key is configured.

For testnet, env-managed wallet encryption is acceptable. Before mainnet, move this custody model to AWS KMS, HashiCorp Vault, or a similar reviewed secret-management system.

### 3. Org-Level Custodial Wallets

Implemented in:

- `packages/api/src/lib/wallet.ts`
- `packages/api/src/modules/access-request/access-request.service.ts`
- `packages/api/src/workers/anchor-passport.worker.ts`

How it works:

1. When an organisation needs blockchain capability, TRACE lazily generates a VeChain wallet.
2. The wallet private key is encrypted with AES-256-GCM using `WALLET_ENCRYPTION_KEY`.
3. The encrypted private key is stored in `organisations.blockchain_private_key_enc`.
4. The public address is stored in `organisations.blockchain_address`.
5. Org users may have `users.blockchain_address` backfilled to the org wallet address for compatibility/display.
6. Private keys are never returned through API responses.

The API now explicitly sanitizes organisation responses so `blockchainPrivateKeyEnc` does not leak through admin access-request views.

### 4. Passport Anchoring And Fee Delegation

Implemented in:

- `packages/api/src/workers/anchor-passport.worker.ts`
- `packages/api/src/lib/vechain-transactions.ts`

Old model:

- Passport anchoring depended on the deployer/global key.

New model:

- Passport anchoring origin is the organisation wallet.
- Before the first passport anchor, TRACE checks whether the org wallet has `HUB_ROLE`.
- If missing, TRACE grants `HUB_ROLE` using `DEPLOYER_PRIVATE_KEY`.
- The passport is anchored by calling `MaterialRegistry.registerPassport(...)` from the org wallet.
- Gas is paid by the configured fee delegation path.
- VTHO spend, gas payer, gas used, tx hash, block, and failures are logged.

The user never sees VTHO or wallet prompts. They only see pending, verified, or failed certificate states.

### 5. Audit Logging

Implemented in:

- `packages/api/src/lib/audit.ts`
- `packages/api/src/modules/audit/audit.routes.ts`
- API route handlers for passports, access requests, marketplace, and quality reports.

Success events are logged for:

- Passport create/update.
- Passport anchor success/failure.
- Organisation `HUB_ROLE` grant success/failure.
- Listing create/update/cancel.
- Marketplace offer.
- Marketplace transaction status changes.
- Quality report create/dispute.
- Access request submit/update/approve/reject.
- Organisation updates.

Failed mutation attempts are also logged by a Fastify hook for key routes. These logs include method, URL, route path, status code, user agent, request origin, actor details when authenticated, and failure reason.

Admin endpoints:

```text
GET /api/v1/audit/events
GET /api/v1/audit/blockchain-transactions
```

Both are platform-admin only.

### 6. Admin Activity And VTHO View

Implemented in:

- `packages/web/src/app/(dashboard)/admin/activity/page.tsx`
- `packages/web/src/components/DashboardLayout.tsx`

Route:

```text
/admin/activity
```

Visible to:

- `platform_admin`

Shows:

- Recent VTHO spend from logged blockchain transactions.
- Gas payer balance status.
- Transaction status counts.
- Recent blockchain transaction logs.
- Recent user/platform audit events.
- Failure reasons and request origins where available.

Gas payer balance states:

- `ok`
- `warning`
- `critical`
- `external`
- `unconfigured`
- `unknown`

Thresholds are controlled by:

```bash
VTHO_WARNING_THRESHOLD_WEI=
VTHO_CRITICAL_THRESHOLD_WEI=
```

### 7. Walletless Buyer Flow

Implemented in:

- `packages/api/src/modules/marketplace/marketplace.routes.ts`
- `packages/api/src/modules/marketplace/marketplace.test.ts`
- `packages/web/src/app/(auth)/login/page.tsx`
- `packages/web/src/app/(auth)/register/page.tsx`
- `packages/web/src/app/marketplace/[id]/page.tsx`
- `packages/web/src/components/DashboardLayout.tsx`

How it works now:

1. Buyer browses the public marketplace.
2. Buyer opens a listing.
3. If unauthenticated, they are redirected to login/register with `next=/marketplace/:id`.
4. After login/register, they return to the listing.
5. Buyer makes an offer.
6. TRACE stores the offer against the buyer user ID.
7. Audit metadata records `buyerModel: walletless_buyer` when the buyer has no organisation.
8. Buyer can view orders without an organisation or wallet.

There is no universal buyer wallet and no per-buyer custodial wallet. Buyer attribution is DB/audit based.

Buyer navigation is now limited to buyer-relevant surfaces:

- Marketplace
- Orders
- Seller access
- Scan QR

### 8. Passport Certificate API And UI

Implemented in:

- `packages/api/src/modules/passport/passport.routes.ts`
- `packages/api/src/modules/passport/passport.service.ts`
- `packages/web/src/components/passport/CertificatePanel.tsx`
- `packages/web/src/app/passport/[id]/page.tsx`
- `packages/web/src/app/(dashboard)/passports/[id]/page.tsx`

API:

```text
GET /api/v1/passports/:id/certificate
```

Returns:

- `status`: `pending`, `verified`, or `failed`
- `certificateHash`
- `certificateId`
- `txHash`
- `registeredAt`
- `blockNumber`
- `blockId`
- `hub.name`
- `hub.address`
- `onchainVerified`
- `failureReason`
- `lastAttemptAt`

UI wording:

- Data hash -> Certificate hash
- Transaction hash -> Certificate ID
- Block number -> Verification block
- Wallet address -> Hub identity

Certificate panels are shown on:

- Public passport page: `/passport/:id`
- Dashboard passport detail: `/passports/:id`

### 9. TRACE Solo Mini-Explorer

Implemented in:

- `packages/api/src/modules/blockchain/blockchain.routes.ts`
- `packages/web/src/app/explorer/tx/[txHash]/page.tsx`

API:

```text
GET /api/v1/blockchain/transactions/:txHash
```

Web:

```text
/explorer/tx/:txHash
```

Behavior:

- On Solo/local staging, certificate links use TRACE's mini-explorer.
- On testnet/mainnet, set `NEXT_PUBLIC_VECHAIN_EXPLORER_URL` and certificate links go to the external explorer.

The API fetches transaction/receipt data from Thor and joins it with the local blockchain transaction log where available. It also decodes known `registerPassport` and `grantHubRole` calldata.

### 10. Passport Creation UX

Implemented in:

- `packages/web/src/components/passport/RegisterWizard.tsx`

Old behavior:

- User submitted the passport and was immediately redirected.

New behavior:

1. User submits the wizard.
2. Passport is created in TRACE.
3. The wizard moves to a final `Verification` step.
4. A skeleton passport and pulsing badge show anchoring progress.
5. The page polls `/api/v1/passports/:id/certificate`.
6. If verified, the CTA becomes `Open verified passport`.
7. If still pending or delayed, the user can choose `Open passport anyway`.

This is the production-like UX for Solo, testnet, and mainnet. No fake delay was added.

## How To Work With It

### Local Docker URLs

When running through Docker Compose in this staging workspace:

```text
Web: http://127.0.0.1:4003
API: http://127.0.0.1:4004
Thor Solo: http://127.0.0.1:8670
Postgres: localhost:15433
Redis: localhost:16380
MinIO: http://127.0.0.1:29001
```

### Start Or Rebuild The App

```bash
docker compose up -d --build api web
```

Check status:

```bash
docker compose ps api web
```

Smoke test:

```bash
curl http://127.0.0.1:4004/health
curl -I http://127.0.0.1:4003/marketplace
```

### Configure Wallets And Fee Delegation

Minimum local/Solo configuration for anchoring:

```bash
WALLET_ENCRYPTION_KEY=<long-random-secret>
DEPLOYER_PRIVATE_KEY=<0x-prefixed-funded-admin-key>
MATERIAL_REGISTRY_ADDRESS=<deployed-material-registry-address>
VECHAIN_NODE_URL=http://thor-solo:8669
```

Optional local fee delegator private key:

```bash
FEE_DELEGATOR_PRIVATE_KEY=<0x-prefixed-funded-gas-payer-key>
FEE_DELEGATION_REQUIRED=true
```

External fee delegator:

```bash
FEE_DELEGATOR_URL=https://...
FEE_DELEGATION_REQUIRED=true
```

Recommended staging/testnet behavior:

- Keep users walletless.
- Keep org wallet keys hidden.
- Keep the fee delegator funded.
- Watch `/admin/activity` for warning/critical gas payer state.

### Run Migrations

For a clean environment:

```bash
pnpm db:migrate
```

This adds:

- `organisations.blockchain_private_key_enc`
- `audit_events`
- `blockchain_transactions`
- `audit_events.origin`

Local note:

The current local Docker database had an older beta-access schema already applied while the Drizzle journal was out of sync. For this workspace, the new migrations were applied directly to the local database during verification. Clean environments should use `pnpm db:migrate`.

### Verify The Main User Flows

#### Seller/hub passport flow

1. Sign in as a hub user.
2. Go to `/passports/new`.
3. Complete the wizard.
4. Submit.
5. Confirm the final `Verification` step appears.
6. Wait for pending -> verified, or use `Open passport anyway`.
7. Open the passport detail page.
8. Confirm the Blockchain Certificate panel appears.
9. If verified, open the certificate link.

Expected logs:

- `passport.create` audit event.
- `org.grantHubRole` blockchain transaction when the org wallet does not already have role.
- `passport.anchor` blockchain transaction.
- VTHO/gas details in `/admin/activity`.

#### Buyer walletless marketplace flow

1. Open `/marketplace`.
2. Open a listing while signed out.
3. Choose login or register.
4. Confirm redirect returns to the listing.
5. Make an offer.
6. Open `/transactions`.

Expected logs:

- `marketplace.offer` audit event.
- Audit metadata includes `buyerModel: walletless_buyer` for unaffiliated buyers.
- No buyer wallet is created or required.

#### Admin audit flow

1. Sign in as `platform_admin`.
2. Open `/admin/activity`.
3. Confirm recent audit events appear.
4. Confirm blockchain transaction logs appear.
5. Check gas payer status and recent VTHO spend.

To intentionally verify failed-action logging:

1. Submit a duplicate pending access request as a buyer.
2. Open `/admin/activity`.
3. Confirm a failed `access_request.submit` event appears with a failure reason and origin.

## API Reference

### Certificate

```text
GET /api/v1/passports/:id/certificate
```

Public endpoint. Used by passport detail pages and the verification wizard.

### Blockchain Transaction

```text
GET /api/v1/blockchain/transactions/:txHash
```

Public endpoint. Used by the Solo mini-explorer.

### Audit Events

```text
GET /api/v1/audit/events?limit=40
```

Platform-admin only.

### Blockchain Transaction Logs

```text
GET /api/v1/audit/blockchain-transactions?limit=40
```

Platform-admin only. Includes summary data:

- recent spend in wei
- status counts
- gas payer address
- gas payer energy balance
- gas payer balance status

## Operational Notes

### Pending Verification Troubleshooting

If the wizard stays on `Pending verification` for more than a minute on Solo, check the anchor worker logs first:

```bash
docker compose logs --tail=200 api
```

Common causes:

- `WALLET_ENCRYPTION_KEY` is empty, so TRACE cannot encrypt/generate the org custodial wallet.
- `MATERIAL_REGISTRY_ADDRESS` is empty, so TRACE cannot call the registry contract.
- `DEPLOYER_PRIVATE_KEY` is empty, so TRACE cannot grant `HUB_ROLE` to a new org wallet.
- Thor Solo is not healthy or the registry address points to an old deployment.
- The gas payer has no VTHO.

Check required env without printing secrets:

```bash
docker compose exec -T api sh -lc 'for v in WALLET_ENCRYPTION_KEY DEPLOYER_PRIVATE_KEY MATERIAL_REGISTRY_ADDRESS FEE_DELEGATOR_URL FEE_DELEGATOR_PRIVATE_KEY; do eval val=\$$v; if [ -n "$val" ] && [ "$val" != "0x" ]; then echo "$v=set"; else echo "$v=empty_or_placeholder"; fi; done'
```

After fixing env, restart the API:

```bash
docker compose up -d api
```

Then requeue the affected passport anchor job, or make a small passport update to trigger a new anchor job.

### VTHO

Users should never see a VTHO problem. If gas payer VTHO is low:

1. Top up the fee delegator from faucet or treasury process.
2. Check `/admin/activity`.
3. Retry/requeue failed anchor jobs if required.

### Fee Delegation

Priority order:

1. `FEE_DELEGATOR_URL`
2. `FEE_DELEGATOR_PRIVATE_KEY`
3. `DEPLOYER_PRIVATE_KEY` as non-production fallback

Production should use a real fee delegation service or reviewed gas-payer custody. Do not rely on deployer fallback in production.

### Org Wallets

Org wallet generation is lazy. Existing organisations receive wallets when:

- an access request approval resolves that organisation and `WALLET_ENCRYPTION_KEY` is configured, or
- the first passport anchor needs the org wallet.

Private key handling rules:

- Never print private keys in logs.
- Never expose `blockchain_private_key_enc` through API responses.
- Rotate `WALLET_ENCRYPTION_KEY` only with a planned re-encryption procedure.

### Certificate States

`pending` means:

- no successful anchor has been recorded yet, or
- the latest transaction is still waiting for confirmation.

`verified` means:

- the passport has a stored tx hash and anchor timestamp, and
- on-chain verification has not returned a mismatch.

`failed` means:

- the latest blockchain transaction log failed, or
- on-chain verification returned a certificate hash mismatch.

## Verification Performed

Commands run after implementation:

```bash
pnpm --filter @trace/api typecheck
pnpm --filter @trace/web typecheck
pnpm --filter @trace/core typecheck
pnpm --filter @trace/db typecheck
pnpm --filter @trace/contracts typecheck
```

API tests:

```bash
DATABASE_URL=postgresql://trace:trace@localhost:15433/trace \
REDIS_URL=redis://localhost:16380 \
MINIO_ENDPOINT=localhost \
MINIO_PORT=29000 \
pnpm --filter @trace/api test
```

Result:

```text
Test Files  6 passed
Tests       39 passed
```

Builds:

```bash
pnpm --filter @trace/core build
pnpm --filter @trace/db build
pnpm --filter @trace/api build
pnpm --filter @trace/web build
pnpm --filter @trace/contracts compile
```

Docker refresh:

```bash
docker compose up -d --build api web
```

Smoke checks:

```bash
curl http://127.0.0.1:4004/health
curl -I http://127.0.0.1:4003/marketplace
```

Both passed.

## Files To Know

Backend:

- `packages/api/src/lib/wallet.ts`
- `packages/api/src/lib/audit.ts`
- `packages/api/src/lib/vechain-transactions.ts`
- `packages/api/src/workers/anchor-passport.worker.ts`
- `packages/api/src/modules/passport/passport.routes.ts`
- `packages/api/src/modules/passport/passport.service.ts`
- `packages/api/src/modules/audit/audit.routes.ts`
- `packages/api/src/modules/blockchain/blockchain.routes.ts`
- `packages/api/src/modules/marketplace/marketplace.routes.ts`
- `packages/api/src/modules/access-request/access-request.service.ts`

Frontend:

- `packages/web/src/components/passport/RegisterWizard.tsx`
- `packages/web/src/components/passport/CertificatePanel.tsx`
- `packages/web/src/app/(dashboard)/admin/activity/page.tsx`
- `packages/web/src/app/explorer/tx/[txHash]/page.tsx`
- `packages/web/src/app/marketplace/[id]/page.tsx`
- `packages/web/src/components/DashboardLayout.tsx`

Data/types:

- `packages/db/drizzle/schema.ts`
- `packages/db/migrations/0002_wallets_audit_blockchain.sql`
- `packages/db/migrations/0003_audit_event_origin.sql`
- `packages/core/src/types/audit.ts`
- `packages/core/src/types/passport.ts`
- `packages/web/src/lib/api-client.ts`

## Next Recommended Work

1. Add a deliberate admin action to retry failed passport anchoring jobs.
2. Add a gas-payer top-up runbook for testnet.
3. Add deeper e2e/browser coverage for the wizard verification step and buyer listing redirect.
4. Decide the mainnet custody implementation: AWS KMS, HashiCorp Vault, or equivalent.
5. Build the separate synthetic beta data plan outside this feature set.
