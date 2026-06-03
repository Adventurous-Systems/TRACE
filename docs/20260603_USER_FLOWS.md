# TRACE User Flows

Date: 2026-06-03
Source branch: `staging`
Source commit: `dc7f739`

This document maps the current staging product flows to pages, API routes, database tables, permissions, and known edge cases. It is based on the implemented Next.js app, Fastify API modules, seed data, and smoke-test flow.

## Flow Index

| Flow | Primary Users | Entry Points | Outcome |
|---|---|---|---|
| Public discovery | Visitor, buyer | `/`, `/marketplace`, `/passport/:id`, `/scan` | Understand TRACE, inspect listed materials, verify QR passports |
| Authentication | Visitor, buyer, staff, admin, inspector | `/register`, `/login` | User has a JWT-backed session |
| Buyer access request | Buyer, platform admin | `/access-request`, `/admin/access-requests` | Buyer is approved, rejected, or later revoked |
| Hub dashboard | Hub staff, hub admin, platform admin | `/dashboard` | Hub sees recent passports and inventory state |
| Material passport registration | Hub staff, hub admin, platform admin | `/passports/new` | Material passport is created, QR generated, anchoring queued |
| Passport detail and photo upload | Hub staff, hub admin, platform admin, visitor | `/passports/:id`, `/passport/:id` | Private management view and public verification view |
| Marketplace listing | Hub staff, hub admin, platform admin | `/listings`, `/listings/new`, `/marketplace` | Active passport is listed for sale |
| Marketplace offer and order | Buyer, seller | `/marketplace/:id`, `/transactions` | Offer creates a transaction, then buyer/seller manage status |
| Quality report | Inspector, hub admin, platform admin | `/quality`, `/quality/new` | Quality report is attached to a passport |
| Feedback | Any dashboard user, platform/hub admin | Floating widget, `/admin/feedback` | Feedback is submitted and reviewed |
| Audit and blockchain activity | Platform admin, public tx viewer | `/admin/activity`, `/explorer/tx/:txHash` | Admin monitors activity and VTHO status |

## Personas and Seeded Accounts

The staging seed script creates these accounts for demos and smoke tests.

| Persona | Role | Seeded Email | Default Password | Primary Jobs |
|---|---|---|---|---|
| Platform Admin | `platform_admin` | `platform@trace.eco` | `Platform1234!` | Approve access, inspect feedback, monitor audit/VTHO |
| Hub Admin | `hub_admin` | `admin@stirlingreuse.com` | `Admin1234!` | Manage hub materials and view feedback |
| Hub Staff | `hub_staff` | `staff@stirlingreuse.com` | `Staff1234!` | Register passports, upload photos, create listings |
| Inspector | `inspector` | `inspector@trace.eco` | `Inspector1234!` | Submit quality reports |
| Buyer | `buyer` | `buyer@example.com` | `Buyer1234!` | Browse marketplace, make offers, request seller access |

Seeded organisation:

| Organisation | Type | Slug | Verified |
|---|---|---|---|
| Stirling Reuse Hub | `hub` | `stirling` | Yes |

Seeded materials:

| Material | Status | Grade | Demo Purpose |
|---|---|---|---|
| Reclaimed Victorian Red Brick | `active` | B | Can be listed |
| Steel I-Beam - 203 x 133 x 25 UB | `listed` | A | Marketplace listing scenario |
| Natural Welsh Slate Roofing | `draft` | C | Draft/private visibility scenario |

## Authentication and Session Flow

### Purpose

Create or restore a user session and route the user into the correct product area.

### Entry Points

| Page | Component/File | API |
|---|---|---|
| `/register` | `packages/web/src/app/(auth)/register/page.tsx` | `POST /api/v1/auth/register` |
| `/login` | `packages/web/src/app/(auth)/login/page.tsx` | `POST /api/v1/auth/login` |
| Protected app pages | `packages/web/src/middleware.ts` | `GET /api/v1/auth/me` |

### Technical Flow

1. Visitor opens `/register` or `/login`.
2. Form submits to `auth.register()` or `auth.login()` in `packages/web/src/lib/api-client.ts`.
3. API validates with `LoginSchema` or `RegisterSchema`.
4. Registration always creates role `buyer`.
5. API returns `{ token, user }`.
6. Frontend stores the token in `localStorage` and in the `trace_auth` cookie for middleware redirects.
7. Buyers are sent to `/marketplace`; elevated roles are sent to `/dashboard`.

### Data

| Table | Usage |
|---|---|
| `users` | Email, password hash, name, role, organisation id |

### Permissions

Registration and login are public. `/api/v1/auth/me` requires a valid JWT.

### Failure States

| State | User Sees / System Does |
|---|---|
| Invalid credentials | API returns unauthorized error |
| Duplicate email | API returns conflict error |
| Expired token | Frontend clears session and redirects to login |
| Missing token on protected route | Middleware redirects to `/login` |

### Known Gaps

Tokens are stored in `localStorage` and a non-HttpOnly cookie. This is workable for staging demos but should move to secure HttpOnly cookies before a production-grade auth posture.

## Public Discovery and Verification Flow

### Purpose

Let visitors inspect TRACE, browse active listings, scan a QR code, and verify material passports without an account.

### Entry Points

| Page | Purpose | API |
|---|---|---|
| `/` | Public product introduction | None |
| `/marketplace` | Browse active listings | `GET /api/v1/marketplace/listings` |
| `/marketplace/:id` | View listing detail | `GET /api/v1/marketplace/listings/:id` |
| `/passport/:id` | Public passport verification | `GET /api/v1/passports/:id/verify`, `GET /api/v1/passports/:id/certificate` |
| `/scan` | QR scanner/manual passport lookup | Navigates to passport routes |
| `/explorer/tx/:txHash` | Mini transaction explorer | `GET /api/v1/blockchain/transactions/:txHash` |

### Technical Flow

1. Visitor browses active listings on `/marketplace`.
2. Search and filters are sent as query params for category, condition grade, and text query.
3. Visitor opens a listing detail page and can view a linked public passport.
4. QR scanner extracts a passport id from a scanned URL or manual input.
5. Public passport page loads passport verification and certificate data.
6. If a blockchain transaction hash exists, the mini explorer can inspect the local log and chain receipt.

### Data

| Table | Usage |
|---|---|
| `listings` | Public marketplace records where status is `active` |
| `material_passports` | Passport identity, condition, carbon, QR, verification fields |
| `quality_reports` | Public quality report data for a passport |
| `blockchain_transactions` | Local blockchain transaction log |

### Failure States

| State | User Sees / System Does |
|---|---|
| No matching listings | Empty marketplace state |
| Listing not found | Listing detail not found state |
| Passport not found | Public passport error/not found |
| Draft passport and visitor not in owner org | Not found |
| Chain/node unreachable | Certificate may remain pending or on-chain verification is null |

## Buyer Access Request Flow

### Purpose

Allow a buyer to request seller/hub access without self-assigning elevated roles.

### Entry Points

| Page | Purpose | API |
|---|---|---|
| `/access-request` | Buyer request form and request history | `GET /api/v1/access-requests/mine`, `POST /api/v1/access-requests` |
| `/admin/access-requests` | Platform-admin review | Access request admin routes |

### Buyer Flow

1. Buyer signs in or registers.
2. Buyer opens `/access-request`.
3. Page loads the buyer's request history.
4. If there is no active pending request, buyer submits requested role and organisation name.
5. API verifies the caller is currently a `buyer`.
6. API rejects duplicate pending requests.
7. Request is stored as `pending`.
8. Buyer sees pending status until reviewed.

### Platform Admin Flow

1. Platform admin opens `/admin/access-requests`.
2. Admin views pending requests, approved users, and organisations.
3. Admin can edit pending request role/name/notes.
4. Admin approves into `hub_staff` or `hub_admin`, linked to an existing or newly created hub organisation.
5. Admin can reject a pending request.
6. Admin can later update approved user role, reassign organisation, or revoke user back to `buyer`.
7. Revoked or rejected buyers can submit a fresh request later.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/access-requests` | POST | Authenticated buyer only, enforced in service |
| `/api/v1/access-requests/mine` | GET | Authenticated user |
| `/api/v1/access-requests` | GET | `platform_admin` |
| `/api/v1/access-requests/:id` | PATCH | `platform_admin` |
| `/api/v1/access-requests/:id/approve` | POST | `platform_admin` |
| `/api/v1/access-requests/:id/reject` | POST | `platform_admin` |
| `/api/v1/access-requests/:id/approved-user` | PATCH | `platform_admin` |
| `/api/v1/access-requests/organisations` | GET | `platform_admin` |
| `/api/v1/access-requests/organisations/:id` | PATCH | `platform_admin` |

### Data

| Table | Usage |
|---|---|
| `beta_access_requests` | Request status, notes, target org, reviewer |
| `users` | Role and organisation updates |
| `organisations` | Existing or newly created hub organisation |
| `audit_events` | Admin and request actions |

### Failure States

| State | User Sees / System Does |
|---|---|
| Non-buyer submits request | Forbidden |
| Duplicate pending request | Conflict |
| Hub admin tries to approve | Forbidden, approval is platform-admin only |
| Approval missing organisation | Validation error |

## Hub Dashboard Flow

### Purpose

Give hub users a quick operational view of recent passports and inventory status.

### Entry Points

| Page | API |
|---|---|
| `/dashboard` | `GET /api/v1/passports?limit=5` |

### Technical Flow

1. User with elevated role logs in.
2. Dashboard layout checks session.
3. Dashboard calls passport list with the current user's organisation.
4. User sees total passports, active count, anchored-on-chain count, and recent passports.
5. User can navigate to registration, passport list, listings, orders, quality, scan, admin tools, or feedback widget.

### Data

| Table | Usage |
|---|---|
| `material_passports` | Dashboard summary |

### Failure States

| State | System Does |
|---|---|
| No organisation id | API returns `NO_ORGANISATION` |
| No passports | Empty state with register link |

## Material Passport Registration Flow

### Purpose

Register a reclaimed construction material with identity, circular, environmental, and verification data.

### Entry Points

| Page | Component | API |
|---|---|---|
| `/passports/new` | `RegisterWizard` | `POST /api/v1/passports` |

### Technical Flow

1. Hub staff, hub admin, or platform admin opens `/passports/new`.
2. Wizard captures basic info, material specs, circular data, environmental data, and review.
3. Draft wizard data is persisted in browser `localStorage` until submitted.
4. API validates with `CreatePassportSchema`.
5. API inserts a passport for the user's organisation.
6. API generates a public QR pointing to `/passport/:id`.
7. API uploads QR image to MinIO and stores the URL.
8. Passport is updated to `active`.
9. API records a passport event.
10. Anchor queue job is added.
11. Wizard enters verification status view and polls certificate status.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/passports` | POST | `hub_staff`, `hub_admin`, `platform_admin` |
| `/api/v1/passports/:id/certificate` | GET | Public |

### Data

| Table | Usage |
|---|---|
| `material_passports` | Passport record and verification fields |
| `passport_events` | Creation event |
| `blockchain_transactions` | Anchor attempts, when anchoring runs |

External services:

| Service | Usage |
|---|---|
| MinIO | QR image storage |
| Redis/BullMQ | Anchor job queue |
| VeChain node | Future live anchoring when configured |

### Failure States

| State | User/System Behavior |
|---|---|
| Missing auth token | Redirect to login |
| User has no organisation | API returns `NO_ORGANISATION` |
| QR/MinIO failure | Passport creation may fail before active completion |
| `MATERIAL_REGISTRY_ADDRESS` unset | Anchor job fails, which is intentional for the workshop |

## Passport Management and Photo Upload Flow

### Purpose

Let hub users inspect passport detail, upload condition photos, review reports, and navigate to public verification.

### Entry Points

| Page | API |
|---|---|
| `/passports` | `GET /api/v1/passports` |
| `/passports/:id` | `GET /api/v1/passports/:id`, `GET /api/v1/quality/reports/passport/:passportId` |
| `/passport/:id` | Public verification page |

### Technical Flow

1. Hub user opens `/passports`.
2. Page fetches organisation-scoped passports with search/status filters.
3. Active passports show a "List for sale" action.
4. User opens `/passports/:id`.
5. Detail page loads passport and public quality reports.
6. User uploads JPEG, PNG, WebP, or HEIC condition photos.
7. API verifies the passport belongs to user's organisation.
8. Photo is stored in MinIO and appended to `conditionPhotos`.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/passports` | GET | Authenticated, organisation-scoped |
| `/api/v1/passports/:id` | GET | Public for active, org-private for draft |
| `/api/v1/passports/:id` | PATCH | `hub_staff`, `hub_admin`, `platform_admin`, org-owned |
| `/api/v1/passports/:id/photos` | POST | `hub_staff`, `hub_admin`, `platform_admin`, org-owned |
| `/api/v1/passports/:id/verify` | GET | Public |
| `/api/v1/passports/:id/certificate` | GET | Public |
| `/api/v1/passports/:id/history` | GET | Public |

### Data

| Table | Usage |
|---|---|
| `material_passports` | Passport details and condition photo URLs |
| `passport_events` | History |
| `quality_reports` | Inspection reports |

### Failure States

| State | User/System Behavior |
|---|---|
| Draft viewed by non-owner | Not found |
| Upload has invalid MIME type | API returns invalid type |
| Upload over 10 MB | Multipart limit rejects upload |
| Non-owner updates passport | Forbidden |

## Marketplace Listing Flow

### Purpose

Allow hubs to list active material passports for reuse.

### Entry Points

| Page | API |
|---|---|
| `/listings` | `GET /api/v1/marketplace/listings/hub` |
| `/listings/new` | `GET /api/v1/passports?status=active`, `POST /api/v1/marketplace/listings` |
| `/marketplace` | `GET /api/v1/marketplace/listings` |

### Technical Flow

1. Hub user opens `/listings/new`.
2. Page loads active passports in the user's organisation.
3. User selects a passport, price, quantity, and shipping option.
4. API validates listing payload.
5. API verifies passport exists and belongs to user's organisation.
6. API rejects already listed, reserved, sold, or decommissioned passports.
7. API creates listing with status `active`.
8. API updates passport status to `listed`.
9. API writes a passport event.
10. Listing appears in public marketplace.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/marketplace/listings` | GET | Public |
| `/api/v1/marketplace/listings` | POST | `hub_staff`, `hub_admin`, `platform_admin` |
| `/api/v1/marketplace/listings/hub` | GET | `hub_staff`, `hub_admin`, `platform_admin` |
| `/api/v1/marketplace/listings/:id` | GET | Public |
| `/api/v1/marketplace/listings/:id` | PATCH | `hub_staff`, `hub_admin`, `platform_admin`, org-owned |

### Data

| Table | Usage |
|---|---|
| `listings` | Listing record |
| `material_passports` | Status moves to `listed` |
| `passport_events` | Offering-for-sale event |

### Failure States

| State | System Behavior |
|---|---|
| No active passports | UI points user to register a material |
| Passport belongs to another organisation | Forbidden |
| Passport already listed/reserved/sold | Conflict |
| Cancel active listing | Listing status becomes `cancelled`, passport status returns to `active` |

## Marketplace Offer and Order Flow

### Purpose

Let buyers make an offer on a listed material and manage the resulting order. This is not a payment flow.

### Entry Points

| Page | API |
|---|---|
| `/marketplace/:id` | `POST /api/v1/marketplace/offers` |
| `/transactions` | `GET /api/v1/marketplace/transactions`, `PATCH /api/v1/marketplace/transactions/:id` |

### Technical Flow

1. Buyer opens a listing detail page.
2. Buyer optionally adds seller notes.
3. If not logged in, buyer is redirected to `/login?next=/marketplace/:id`.
4. Authenticated buyer clicks make offer.
5. API validates listing is active and buyer is not the seller.
6. API creates a transaction with status `pending`.
7. API reserves the listing and passport.
8. Buyer opens `/transactions`.
9. Buyer can confirm delivery, flag dispute, or cancel while pending/confirmed.
10. Buyer or seller can cancel pending/confirmed transactions.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/marketplace/offers` | POST | `buyer`, `hub_staff`, `hub_admin`, `platform_admin` |
| `/api/v1/marketplace/transactions` | GET | Authenticated, user-scoped |
| `/api/v1/marketplace/transactions/:id` | GET | Authenticated |
| `/api/v1/marketplace/transactions/:id` | PATCH | Authenticated, action ownership checked |

### Data

| Table | Usage |
|---|---|
| `transactions` | Offer/order lifecycle |
| `listings` | Status moves active/reserved/sold/cancelled |
| `material_passports` | Status mirrors listed/reserved/sold |
| `passport_events` | Transfer event when completed |

### Status Model

| Status | Meaning |
|---|---|
| `pending` | Offer created, material reserved |
| `confirmed` | Buyer confirmed delivery |
| `disputed` | Buyer flagged dispute |
| `resolved` | Dispute resolved |
| `completed` | Auto-completed when confirmed after dispute deadline |
| `cancelled` | Buyer or seller cancelled pending/confirmed order |

### Known Gaps

There is no checkout, payment capture, webhook, escrow, refund, or invoicing flow. The offer/order flow is a reservation and lifecycle demo only.

Security note from staging audit: the transaction list is user-scoped, but the single transaction read route does not currently enforce buyer/seller ownership.

## Quality Report Flow

### Purpose

Let inspectors and authorised hub/platform users record material condition assessments.

### Entry Points

| Page | API |
|---|---|
| `/quality` | `GET /api/v1/quality/reports/mine` |
| `/quality/new` | `POST /api/v1/quality/reports` |
| `/passports/:id` | `GET /api/v1/quality/reports/passport/:passportId` |

### Technical Flow

1. Inspector opens `/quality/new`, optionally with `?passportId=:id`.
2. Form captures passport id, structural score, aesthetic score, environmental score, grade, and notes.
3. UI suggests an overall grade from score averages.
4. API validates passport exists.
5. API creates quality report.
6. If a grade is supplied, API updates passport condition grade.
7. Report appears on inspector's quality page and on passport detail/public read views.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/quality/reports` | POST | `inspector`, `hub_admin`, `platform_admin` |
| `/api/v1/quality/reports/passport/:passportId` | GET | Public |
| `/api/v1/quality/reports/mine` | GET | `inspector`, `hub_admin`, `platform_admin` |
| `/api/v1/quality/reports/:id` | GET | Public |
| `/api/v1/quality/reports/:id/dispute` | POST | Authenticated |

### Data

| Table | Usage |
|---|---|
| `quality_reports` | Report details |
| `material_passports` | Optional condition grade update |

### Known Gaps

Any authenticated user can currently dispute any quality report. Narrow this before production.

## Feedback Flow

### Purpose

Capture workshop and beta feedback in-app.

### Entry Points

| Page/Component | API |
|---|---|
| Floating feedback widget inside `DashboardLayout` | `POST /api/v1/feedback` |
| `/admin/feedback` | `GET /api/v1/feedback` |

### Technical Flow

1. Dashboard user clicks floating "Feedback" button.
2. User selects rating, category, and message.
3. Widget automatically captures current page URL.
4. API validates rating/category/message.
5. If a valid JWT is present, API attaches `userId`; otherwise feedback is accepted anonymously.
6. Platform admin or hub admin opens `/admin/feedback`.
7. Admin sees average rating, counts by category, and all submissions.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/feedback` | POST | Public, optional JWT |
| `/api/v1/feedback` | GET | `platform_admin`, `hub_admin` |

### Data

| Table | Usage |
|---|---|
| `feedback_submissions` | Rating, category, message, page URL, optional user |

### Failure States

| State | User/System Behavior |
|---|---|
| Missing rating or message | Button disabled |
| Message over 2000 chars | Validation fails |
| Public spam | Limited by global Fastify rate limit only |

## Audit and Blockchain Activity Flow

### Purpose

Let platform admins monitor operational activity, blockchain transaction attempts, gas payer status, and VTHO thresholds.

### Entry Points

| Page | API |
|---|---|
| `/admin/activity` | `GET /api/v1/audit/events`, `GET /api/v1/audit/blockchain-transactions` |
| `/explorer/tx/:txHash` | `GET /api/v1/blockchain/transactions/:txHash` |

### Technical Flow

1. Platform admin opens `/admin/activity`.
2. Page fetches recent audit events and recent blockchain transaction logs.
3. API calculates recent VTHO spend and gas payer status.
4. Public mini explorer can load a transaction hash and show chain receipt, decoded registry method, and local DB log.

### API Routes

| Route | Method | Auth |
|---|---|---|
| `/api/v1/audit/events` | GET | `platform_admin` |
| `/api/v1/audit/blockchain-transactions` | GET | `platform_admin` |
| `/api/v1/blockchain/transactions/:txHash` | GET | Public |

### Data

| Table | Usage |
|---|---|
| `audit_events` | Action history |
| `blockchain_transactions` | Transaction attempts and receipts |
| `organisations` | Gas/wallet context |

### Workshop Constraint

For the June 8 workshop, VeChain anchoring is intentionally off because `MATERIAL_REGISTRY_ADDRESS` should remain unset. Blockchain UI can show pending/failed local status, but testnet proof is a post-workshop go-live step.

## End-to-End Workshop Smoke Flow

This is the current scripted happy path in `scripts/smoke-test.sh`.

1. Health check passes.
2. New buyer signs up.
3. Buyer submits access request.
4. Platform admin approves the request.
5. Hub staff creates a passport.
6. Hub staff uploads a photo.
7. Public passport and verify endpoints return 200.
8. Hub staff creates a listing.
9. Buyer makes an offer.
10. Buyer confirms delivery.
11. Inspector submits quality report.
12. Feedback is submitted.
13. Admin confirms feedback appears in list.

Important correction: access-request approval requires `platform_admin`, not `hub_admin`.

## Route and Permission Summary

| Route Prefix | Public | Authenticated | Role Restricted |
|---|---:|---:|---:|
| `/api/v1/auth/login` | Yes | No | No |
| `/api/v1/auth/register` | Yes | No | No |
| `/api/v1/auth/me` | No | Yes | No |
| `/api/v1/access-requests` | No | Yes | Platform admin for review routes |
| `/api/v1/passports` | Some read routes | Yes | Create/update/upload restricted |
| `/api/v1/marketplace/listings` | Read/search | Yes | Create/update restricted |
| `/api/v1/marketplace/offers` | No | Yes | Buyer/hub/admin |
| `/api/v1/marketplace/transactions` | No | Yes | Action checks in service |
| `/api/v1/quality` | Some read routes | Yes | Create/list mine restricted |
| `/api/v1/feedback` | Submit | Yes optional | Admin list restricted |
| `/api/v1/audit` | No | Yes | Platform admin |
| `/api/v1/blockchain/transactions` | Yes | No | No |

## Current Staging Limitations

These are not all blockers for the workshop, but they are important for product and production planning.

| Limitation | Impact |
|---|---|
| No real payment flow | Marketplace orders must be described as reservations/offers, not paid purchases |
| VeChain anchoring intentionally off | Passport verification is pending/local until post-workshop testnet go-live |
| JWT in localStorage/readable cookie | Production auth hardening required |
| Single transaction read lacks ownership check | Fix before production |
| Quality dispute endpoint too broad | Fix before production |
| Public feedback endpoint accepts anonymous submissions | OK for workshop, needs spam controls later |
| No email verification/invite workflow | Seller onboarding remains admin-reviewed |

