---
name: auth-state-machine
description: >
  Canonical auth and access-request workflow guide for TRACE. Use when: reviewing or
  changing JWT login/register flows, tracing the access request lifecycle (submit →
  pending → approved/rejected → reapply), auditing admin approve/reject/retract logic,
  checking role transitions on approval, verifying org creation on first approval, or
  tracing end-to-end identity state transitions across auth and access-request modules.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
context: fork
---

# Skill: Auth & Access Request State Machine (`auth-state-machine`)

## Name
auth-state-machine

## Persona & Role
You are a Senior Backend Engineer who owns the TRACE identity and access request lifecycle. You trace every state transition end-to-end — from a new user registering as a buyer through to becoming approved hub staff — and flag anywhere the transitions break, diverge from UX expectations, or lack atomicity.

## Primary Objectives
- Maintain a precise mental model of the auth flow and access request state machine.
- Catch divergences between service logic, DB state, frontend UI, and user-facing copy.
- Ensure role promotions and org provisioning happen atomically.

## Auth Flow

### Registration (`POST /api/v1/auth/register`)
1. Validate `RegisterInput` (name, email, password ≥ 8 chars, optional org fields).
2. Check email uniqueness — conflict → `409 ConflictError`.
3. Hash password with bcrypt (10 rounds).
4. Insert user with `role: 'buyer'`, `organisationId: null`.
5. Return JWT payload `{ id, email, role, organisationId }`.

**Invariant:** Newly registered users are ALWAYS buyers with no org. No path allows self-assigning a higher role.

### Login (`POST /api/v1/auth/login`)
1. Validate `LoginInput` (email, password).
2. Look up user by email (case-insensitive).
3. Always run `bcrypt.compare` (dummy hash if user not found — timing attack guard).
4. On success: return JWT signed with `JWT_SECRET`, expiry `JWT_EXPIRY`.
5. On failure: `401 UnauthorizedError` with generic message (no "user not found" vs "wrong password" distinction).

### Token Verification (all protected routes)
- `authenticate` middleware decodes JWT, attaches `request.user`.
- `authorize(...roles)` checks `request.user.role` against allowed list.
- Token in `Authorization: Bearer <token>` header (stored in `localStorage` on client — XSS risk, track for migration).

---

## Access Request State Machine

### States
```
[none] → pending → approved
                 → rejected → pending (reapply)
```

### Submit (`POST /api/v1/access-requests`)
- Any authenticated user (typically buyer) submits a request.
- Request includes: desired `role` (`hub_staff` | `hub_admin`), org name/details, reason.
- Service checks for an existing pending request — duplicate → error.
- Insert `betaAccessRequests` row with `status: 'pending'`.

### Admin Review (`GET /api/v1/access-requests` — `platform_admin` only)
- Lists all requests, filterable by status.
- Admin reads request details, org name, reason.

### Approve (`POST /api/v1/access-requests/:id/approve` — `platform_admin` only)
1. Load the access request record.
2. Verify status is `pending`.
3. **Atomically** (within a DB transaction):
   a. Create or find the organisation record.
   b. Update user: set `role` to approved role, set `organisationId`.
   c. Update access request: set `status: 'approved'`, `reviewedAt`, `reviewedBy`.
4. Return updated user profile.

**Invariant:** Org creation and role promotion MUST be atomic. A user should never have a role without an org or an org without the matching role update.

### Reject (`POST /api/v1/access-requests/:id/reject` — `platform_admin` only)
1. Verify status is `pending`.
2. Update access request: `status: 'rejected'`, `rejectionReason`, `reviewedAt`, `reviewedBy`.
3. User role remains `buyer`, `organisationId` remains `null`.

### Reapply (`POST /api/v1/access-requests` — buyer with a rejected request)
- A buyer with a prior rejected request can submit a new request.
- The old rejected record is preserved (audit trail); a new `pending` row is created.
- The service must NOT allow a new pending request if one already exists (regardless of the rejected one).

---

## Role Reference

| Role | Can do |
|------|--------|
| `buyer` | Browse marketplace, view public passports, submit access request |
| `hub_staff` | Create/manage passports, create listings, submit quality reports |
| `hub_admin` | All hub_staff actions + manage hub users, approve inspectors |
| `platform_admin` | All actions + approve/reject access requests, manage platform |
| `inspector` | Anchor quality reports on-chain |
| `certifier` | (Reserved for future cert workflows) |

---

## Files To Read When Tracing a Flow

| Concern | Files |
|---------|-------|
| Auth routes & schemas | `packages/api/src/modules/auth/auth.routes.ts`, `auth.service.ts` |
| Access request routes | `packages/api/src/modules/access-request/access-request.routes.ts`, `access-request.service.ts` |
| Auth middleware | `packages/api/src/middleware/auth.ts` |
| DB schema | `packages/db/drizzle/schema.ts` (users, betaAccessRequests tables) |
| Validators | `packages/core/src/validators/auth.schema.ts` |
| Frontend auth | `packages/web/src/lib/auth.ts`, `packages/web/src/app/(auth)/` |
| Frontend access request | `packages/web/src/app/access-request/page.tsx` |

---

## Common Divergences To Watch For

- Frontend shows "pending approval" state but backend allows resubmission without checking existing pending.
- Rejection reason stored in DB but never surfaced in the reapply UI (user doesn't know why they were rejected).
- Role promotion happens in two separate DB calls (not a transaction) → window where user has role but no org.
- Admin `reviewedBy` field not being populated (audit gap).
- `organisationId` is null for non-buyer roles after an approval bug.

## Pairing Notes

- **`auth-security`** — for threat modelling the transitions above
- **`schema-pilot`** — to verify DB constraints back the state machine
- **`auth-regression`** — to verify transitions with Vitest integration tests
