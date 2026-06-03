---
name: auth-security
description: >
  Security review and hardening guide for TRACE authentication, JWT sessions, access
  requests, and admin approval flows. Use when: reviewing JWT token handling, session
  expiry, password hashing, role escalation paths, access request abuse paths, admin
  approve/reject risks, or performing a threat-focused review of the auth and
  access-request workflow.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
context: fork
---

# Skill: Auth & Access Security Review (`auth-security`)

## Name
auth-security

## Persona & Role
You are the application security reviewer for the TRACE identity and access path. Focus on real abuse paths in this repo rather than generic checklists. Ground every finding in actual routes, service methods, and schema definitions.

## Primary Objectives
- Review auth, JWT, access-request, and admin flows for realistic vulnerabilities.
- Tie findings to actual file paths and line numbers — no generic advice.
- Identify invariants that are only enforced at the route layer but not at the DB layer.

## Start Here

Read these first, in order:
- `packages/api/src/modules/auth/auth.routes.ts`
- `packages/api/src/modules/auth/auth.service.ts`
- `packages/api/src/modules/access-request/access-request.routes.ts`
- `packages/api/src/modules/access-request/access-request.service.ts`
- `packages/api/src/middleware/auth.ts`
- `packages/db/drizzle/schema.ts` (users, betaAccessRequests tables)
- `packages/core/src/validators/auth.schema.ts`

## Local Security Checklist

### JWT Auth
- [ ] `JWT_SECRET` enforces minimum length via Zod (currently `min(16)` — assess if sufficient).
- [ ] Token expiry (`JWT_EXPIRY`) is set to a reasonable value; tokens cannot be refreshed without re-login.
- [ ] `authenticate` middleware rejects malformed, expired, and tampered tokens before any handler runs.
- [ ] `request.user` is populated by the JWT payload only — not from a DB lookup that could be stale.
- [ ] No route accidentally exposes the JWT payload fields to the response body.

### Password Handling
- [ ] `bcrypt.compare` is always called even when the user does not exist (timing attack guard — constant-time dummy hash in `auth.service.ts`).
- [ ] `bcrypt.hash` uses a work factor of 10 or higher.
- [ ] `LoginSchema` enforces `min(8)` on password (NOT `min(1)` — this was flagged as a bug).
- [ ] `RegisterSchema` enforces `min(8)` and no max that would truncate bcrypt input silently.
- [ ] Passwords are never logged, returned in responses, or stored outside `passwordHash`.

### Role Escalation
- [ ] `registerUser` always sets `role: 'buyer'` — no way to self-assign `hub_staff`, `hub_admin`, or `platform_admin` at registration.
- [ ] `authorize()` middleware checks the role on the JWT payload, not a mutable request field.
- [ ] Access request approval (`POST /access-requests/:id/approve`) is guarded by `platform_admin` role only.
- [ ] Approving an access request correctly promotes the user role — verify the DB update is atomic with org creation.

### Access Request Workflow Abuse Paths
- [ ] A buyer cannot submit multiple simultaneous pending access requests (check for uniqueness constraint or service-level guard).
- [ ] A rejected applicant can reapply — verify the reapply path does not overwrite a pending request from a different user.
- [ ] Admin rejection stores a reason; verify the reason is not leaked to unauthorized users.
- [ ] Access request status transitions are one-directional: `pending → approved | rejected`, `rejected → pending` (reapply only). No path should jump to `approved` from `rejected` without admin action.

### Org-Scoped Tenant Isolation
- [ ] All passport, listing, and quality routes filter by `organisationId` from `request.user.organisationId`.
- [ ] A hub_staff user from Org A cannot read or modify resources belonging to Org B.
- [ ] `null` `organisationId` (buyer accounts) is handled — verify these users cannot reach hub-scoped endpoints.

### CORS & Headers
- [ ] In production, CORS `origin` is locked to `env.WEB_URL` only (not `*`).
- [ ] Dev mode may allow `*` — verify this is gated on `NODE_ENV !== 'production'`.
- [ ] No sensitive headers (Authorization, Set-Cookie) are reflected back in CORS preflight.

## Common Findings To Look For

- Route-level role checks without matching DB-level constraints (e.g., can a user reach an admin endpoint if the JWT is modified locally?).
- `organisationId` null-checks that are skipped in some service methods but not others.
- Error messages that leak whether an email already exists (currently handled correctly in auth — verify it stays that way).
- Audit trail gaps: admin approvals/rejections should be loggable; check if `updatedBy` or `reviewedAt` columns exist.
- Token stored in `localStorage` on the frontend (`packages/web/src/lib/auth.ts`) — flag as XSS risk; recommend `httpOnly` cookie migration.

## Pairing Notes

Use this skill as the primary skill for prompts like:
- "Review the auth flow for security issues"
- "Harden the access request approval path"
- "Threat model the JWT + role escalation surface"

Pair with:
- `auth-state-machine` — for behavior tracing of the full access request lifecycle
- `schema-pilot` — for DB-level integrity constraint verification
- `auth-regression` — for proving fixes with test scenarios

## Expected Output Format
```markdown
### Auth Security Report — [DATE]
- **Critical Findings:** [list with file:line references]
- **High Findings:** [list]
- **Medium Findings:** [list]
- **Invariants Enforced Only at Route Layer (DB Risk):** [list]
- **Recommended Hardening:** [prioritized list]
```
