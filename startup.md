# TRACE — Local Development Startup

## Prerequisites
- Docker Desktop running
- Node 20+, pnpm 9+

---

## First-time setup (run once)

```bash
cd /Users/td3003/GitHub/TRACE

# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Run DB migrations
pnpm --filter @trace/db migrate

# Seed test data
pnpm --filter @trace/db seed
```

---

## Start dev servers (every time)

Open **two terminals** from the project root:

```bash
# Terminal 1 — API (http://localhost:3001)
pnpm --filter @trace/api dev

# Terminal 2 — Web (http://localhost:3000)
pnpm --filter @trace/web dev
```

Also make sure Docker is running (infrastructure):
```bash
docker compose up -d
```

---

## Test credentials

| Role       | Email                       | Password       |
|------------|-----------------------------|----------------|
| Hub Staff  | staff@stirlingreuse.com     | Staff1234!     |
| Hub Admin  | admin@stirlingreuse.com     | Admin1234!     |
| Inspector  | inspector@trace.eco         | Inspector1234! |
| Buyer      | buyer@example.com           | Buyer1234!     |

---

## Key URLs

| Page                  | URL                                      | Auth         |
|-----------------------|------------------------------------------|--------------|
| Homepage              | http://localhost:3000                    | Public       |
| Marketplace browse    | http://localhost:3000/marketplace        | Public       |
| Login                 | http://localhost:3000/login              | —            |
| Dashboard             | http://localhost:3000/dashboard          | Any role     |
| Passports list        | http://localhost:3000/passports          | Hub staff+   |
| Register material     | http://localhost:3000/passports/new      | Hub staff+   |
| Listings management   | http://localhost:3000/listings           | Hub staff+   |
| Create listing        | http://localhost:3000/listings/new       | Hub staff+   |
| Orders / transactions | http://localhost:3000/transactions       | Any role     |
| Quality reports       | http://localhost:3000/quality            | Inspector+   |
| Submit inspection     | http://localhost:3000/quality/new        | Inspector+   |
| QR scanner            | http://localhost:3000/scan               | Any role     |
| API health check      | http://localhost:3001/health             | Public       |

---

## Typical test flow

1. Log in as **Hub Staff** → `/passports/new` → register a material
2. Go to `/listings/new` → pick the material → set price → create listing
3. Check `/marketplace` (public) to see it appear
4. Log out → log in as **Buyer** → `/marketplace` → open a listing → make offer
5. Log back in as **Hub Staff** → `/transactions` → confirm delivery
6. Log in as **Inspector** → `/quality/new?passportId=<id>` → submit quality report
7. View passport detail page → see quality reports section with grade badges
