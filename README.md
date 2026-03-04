# TRACE — Transforming Resources and Advancing Circular Economy

[TRACE](https://trace.construction/) is a blockchain-enabled digital marketplace for construction material reuse hubs. It issues EU DPP-compliant material passports, anchors integrity proofs on VeChainThor, and governs the system through Ostrom commons principles via smart contracts.

**Read [`SPEC.md`](./SPEC.md)** for the full specification. **Read [`startup.md`](./startup.md)** for local dev setup.

---

## Research Team & Partners

**Lead Researchers:**
- Dr Michele Victoria — Lecturer, Robert Gordon University, Aberdeen
- Dr Theodoros Dounas — Associate Professor, Heriot-Watt University, Edinburgh

**Partners:**
- Stirling Reuse Hub (SRH) — Operational insights and real-world testing
- [Adventurous Systems](https://adventurous.systems) — Digital marketplace, smart contract development, and prototype hosting

**Funding:** Scotland Beyond Net Zero · Budget: £13,502.75 · Duration: Aug 2025–Jul 2026

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  ACTORS: Hub Staff · Buyer · Inspector · Public     │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  OFF-CHAIN                                          │
│  Next.js 14 PWA → Fastify API                       │
│  PostgreSQL · Redis · MinIO · Meilisearch           │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  ON-CHAIN — VeChainThor                             │
│  MaterialRegistry · CircularMarketplace             │
│  QualityAssurance · CBT · Governance · HubRegistry  │
└─────────────────────────────────────────────────────┘
```

**Philosophy:** Thin on-chain, rich off-chain. Full passport data in PostgreSQL. Blockchain stores content hashes, ownership records, and governance state.

---

## Monorepo Structure

```
packages/core/        → Shared types, Zod validators, constants, enums
packages/db/          → Drizzle ORM schema, migrations, seed data
packages/api/         → Fastify backend (modules: auth, passport, marketplace, quality)
packages/web/         → Next.js 14 App Router frontend (PWA)
packages/contracts/   → Solidity smart contracts + Hardhat (VeChain plugin)
packages/sdk/         → TypeScript SDK for external consumers
```

---

## Build Status

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 0 | Infrastructure, DB schema, API skeleton | ✅ Complete |
| Sprint 1 | Material passport CRUD · blockchain anchor · QR code · public view | ✅ Complete |
| Sprint 2 | Marketplace listings · transactions · CircularMarketplace.sol | ✅ Complete |
| Sprint 3 | Quality reports · inspector workflow · QualityAssurance.sol | 🔨 In Progress |
| Sprint 4 | Governance · CBT token · DAO voting | 🗓 Planned |
| Sprint 5 | IoT sensor oracle · automated grading | 🗓 Planned |
| Sprint 6 | Analytics dashboard · environmental metrics | 🗓 Planned |

### What's Working (Sprints 0–2)

**Infrastructure**
- Docker Compose: Thor Solo (VeChain), PostgreSQL, Redis, MinIO, Meilisearch
- Full monorepo: pnpm workspaces, TypeScript strict mode throughout

**Smart Contracts (VeChainThor)**
- `MaterialRegistry.sol` — Passport hash anchoring, ownership tracking, batch ops
- `CircularMarketplace.sol` — Listing and transaction records on-chain

**API (Fastify — port 3001)**
- `POST/GET/PATCH /api/v1/passports` — Material passport CRUD
- `GET /api/v1/passports/:id/verify` — Blockchain hash verification
- `GET/POST /api/v1/marketplace/listings` — Public browse + hub listing management
- `POST /api/v1/marketplace/offers` — Buyer offer submission
- `GET/PATCH /api/v1/marketplace/transactions` — Order lifecycle management
- Background worker: BullMQ → VeChain anchor on passport creation

**Frontend (Next.js — port 3000)**
- `/` — Public homepage
- `/marketplace` — Public material browse with search/filter
- `/passport/[id]` — Public passport view (QR scan landing)
- `/scan` — Camera QR scanner
- `/login` — JWT authentication
- `/dashboard` — Hub staff overview
- `/passports` — Inventory management
- `/passports/new` — 5-step material registration wizard
- `/passports/[id]` — Passport detail with blockchain status
- `/listings` — Hub listing management
- `/listings/new` — Create listing form
- `/transactions` — Order management

### Sprint 3 Scope (In Progress)

- **Quality API:** `POST /api/v1/quality/reports`, `GET /api/v1/quality/reports/:passportId`
- **QualityAssurance.sol:** Inspector registry, report hash anchoring, dispute flagging
- **Inspector UI:** Submit quality report form, report history, passport quality tab
- **Passport detail:** Quality reports section with grade badges

---

## Quick Start

See **[startup.md](./startup.md)** for full instructions.

```bash
# Start infrastructure
docker compose up -d

# Install + migrate + seed
pnpm install
pnpm --filter @trace/db migrate
pnpm --filter @trace/db seed

# Dev servers
pnpm --filter @trace/api dev   # http://localhost:3001
pnpm --filter @trace/web dev   # http://localhost:3000
```

**Test credentials:**

| Role | Email | Password |
|------|-------|----------|
| Hub Staff | staff@stirlingreuse.com | Staff1234! |
| Hub Admin | admin@stirlingreuse.com | Admin1234! |
| Inspector | inspector@trace.eco | Inspector1234! |
| Buyer | buyer@example.com | Buyer1234! |

---

## Key Design Decisions

1. **VeChainThor** over Base/Optimism — enterprise focus, fee delegation (users need no crypto), multi-clause batch transactions, sustainability alignment
2. **Fastify** over Express — 2-3x faster, built-in schema validation, TypeScript-first
3. **Drizzle** over Prisma — lighter, SQL-first, better for JSONB
4. **Modular monolith** — single deployable, clean module boundaries, extractable to microservices later
5. **PWA** over native apps — single codebase, no app store friction, camera + offline via browser
6. **Material passport schema is universal** — designed for any EU DPP construction material; circular metadata is an extension layer
