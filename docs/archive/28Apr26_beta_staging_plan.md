# Beta Staging Plan - User Testing on Thor Solo

_Date: 28 Apr 2026_

## The Core Question

Beta testers need to experience the full platform value without ever touching a wallet, and without the chain feeling like a toy. Staging should be structurally close to testnet and mainnet: users sign in, create or buy materials, and TRACE handles wallets, signatures, fee delegation, certificate display, and auditability behind the scenes.

## 1. Auth Identities, Wallets, And Fee Delegation

### Decision

Use org-level custodial wallets for hubs. Each organisation has a generated VeChain keypair:

- `organisations.blockchain_address`
- `organisations.blockchain_private_key_enc`

Private keys are encrypted with `WALLET_ENCRYPTION_KEY` and decrypted only in memory while signing. For testnet this stays simple with an env-managed encryption secret. Before mainnet, revisit AWS KMS, HashiCorp Vault, or a similar OSS-backed custody setup.

### On-chain Attribution

Passport anchoring should be signed by the hub wallet, not the global deployer. The explorer should show the hub as the origin, while users inside the hub remain tracked in Postgres and audit logs.

### Fee Delegation

Fee delegation is part of this plan because production depends on it.

- Passport registration origin: hub wallet.
- Gas payer: `FEE_DELEGATOR_URL` when configured, otherwise `FEE_DELEGATOR_PRIVATE_KEY` for Solo/local staging.
- The deployer key remains available for platform operations such as granting `HUB_ROLE`.
- Users never see VTHO requirements or wallet prompts.

VTHO risk is operational: staging/testnet needs enough faucet funding or regular top-ups for the gas payer. The user should only ever see pending/verified/failed certificate states, never a VTHO problem.

## 2. Buyer Flow

Unaffiliated buyers stay walletless.

The buyer is represented by their TRACE sign-in identity, not by a universal buyer wallet and not by per-buyer custodial keys. Marketplace offers and orders are stored against `buyerId`; on-chain marketplace buyer addresses can remain `address(0)` in a later marketplace-contract phase. This keeps attribution strong in TRACE while avoiding fake shared-wallet semantics.

Expected flow:

1. Buyer browses public marketplace.
2. Buyer opens a listing and signs in or registers if needed.
3. Login/register preserves `next=/marketplace/:id`.
4. Buyer makes an offer.
5. TRACE logs actor, listing, amount, status, and buyer model as `walletless_buyer`.
6. Buyer sees orders without needing an organisation.

Buyer dashboard navigation should show buyer-relevant surfaces only: Marketplace, Orders, Seller access request, and QR scan.

## 3. Audit Logging And VTHO Visibility

Add durable audit logging, not just console logs.

### Audit Events

Record critical user and platform actions:

- Passport create/update.
- Passport anchor success/failure.
- Listing create/update/cancel.
- Marketplace offer and transaction status changes.
- Quality report create/dispute.
- Access request submit/update/approve/reject.
- Organisation updates.

Each event should include actor, role, email, organisation, action, resource type/id, status, failure reason, metadata, and timestamp.

### Blockchain Transactions

Record every sponsored chain attempt:

- action and resource
- origin address
- gas payer address
- contract address
- tx hash
- submitted/confirmed timestamps
- gas limit, gas used, VTHO paid
- block number/id
- status and failure reason

Platform admins need an "Activity & VTHO" view showing recent action logs, transaction failures, recent VTHO spend, and gas-payer balance state.

## 4. Passport Certificate UX

Use TRACE language rather than crypto language:

| Crypto language | TRACE language |
| --- | --- |
| Transaction hash | Certificate ID |
| Data hash | Certificate hash |
| Block number | Verification block |
| Wallet address | Hub identity |
| VTHO gas fee | Hidden from normal users |
| Smart contract | Digital ledger |

Build a "Blockchain Certificate" panel for passport detail and public passport pages:

- pending, verified, and failed states
- Certificate hash
- Certificate ID
- registered timestamp
- verification block
- hub identity
- "View certificate" link

Explorer behavior:

- Solo/staging: `/explorer/tx/:txHash` mini-explorer in TRACE.
- Testnet: `NEXT_PUBLIC_VECHAIN_EXPLORER_URL=https://explore-testnet.vechain.org`.
- Mainnet: `NEXT_PUBLIC_VECHAIN_EXPLORER_URL=https://explore.vechain.org`.

The Solo mini-explorer proxies through the API and decodes `registerPassport` calldata so testers can see the passport ID, certificate hash, metadata URI, gas used, gas payer, VTHO paid, and confirmation block.

## 5. Anchoring Progress UX

Recommendation accepted: Option B.

Build the real production pending UX instead of adding artificial delays. After passport creation:

1. The wizard moves to an explicit "Verification" step.
2. A skeleton passport and pulsing badge show that the certificate is being registered.
3. The UI polls the certificate endpoint.
4. When anchoring succeeds, the button changes to "Open verified passport".
5. If anchoring is slow, the user can still open the passport anyway.

This makes Solo, testnet, and mainnet use the same interaction model even though block times differ.

## 6. Implementation Sequence

1. Fix existing typecheck blockers.
2. Add schema and migration for encrypted org wallets, audit events, and blockchain transaction logs.
3. Add wallet encryption/generation and lazy org wallet backfill.
4. Grant `HUB_ROLE` to org wallets before first passport anchor.
5. Send passport anchors from org wallets with fee delegation where configured.
6. Add certificate and blockchain transaction API endpoints.
7. Add admin audit/VTHO endpoints and UI.
8. Update buyer login/register/listing/order flow for walletless buyers.
9. Add pending verification wizard step and certificate panels.

## 7. Explicitly Out Of Scope

- Synthetic beta data and synthetic images. This will be its own plan.
- Marketplace contract wiring.
- Quality report contract wiring.
- WalletConnect, MetaMask, seed phrases, user-visible wallet management.
- Per-user wallets.
- NFTs, token gating, cross-chain support.

## 8. Notes For Testnet

- Keep key custody simple for testnet with env-managed encryption, but record the mainnet decision point for KMS/Vault.
- Use "Certificate hash" in the UI.
- Do not implement synthetic images now.
- Monitor gas-payer VTHO and top up from faucet before it becomes user-visible.
- The create wizard should include a skeleton passport with a pulsing verification badge as a clear progress step.
