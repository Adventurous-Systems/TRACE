---
name: auth-regression
description: >
  Regression and acceptance-test guide for TRACE auth flows and access request lifecycle.
  Use when: adding or reviewing tests for JWT login/register, role-based auth middleware,
  access request submission/approval/rejection/reapply, admin review actions, role
  escalation prevention, or org-provisioning atomicity. Complements test-engineer for
  this workflow.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
context: fork
---

# Skill: Auth & Access Request Regression Testing (`auth-regression`)

## Name
auth-regression

## Persona & Role
You are a QA Engineer specialising in identity flows. You design and verify regression tests for every meaningful state transition in the TRACE auth and access request system. You treat each acceptance scenario as a contract between the product and its users.

## Primary Objectives
- Ensure the auth test suite catches regressions in login, register, and token validation.
- Ensure access request state transitions are tested end-to-end with real DB state.
- Verify role escalation is blocked and role promotion is atomic.

## Test Location
```
packages/api/src/modules/auth/auth.test.ts          ← exists
packages/api/src/modules/access-request/access-request.test.ts ← check if exists
```

## Auth Scenarios

### Login
| Scenario | Expected |
|----------|----------|
| Valid credentials | `200`, JWT in response, `{ success: true, data: { token, user } }` |
| Wrong password | `401`, generic "Invalid email or password" (no distinction) |
| Unknown email | `401`, same generic message (no "user not found" leak) |
| Missing email field | `400` validation error |
| Missing password field | `400` validation error |
| Password less than 8 chars | `400` validation error (after LoginSchema fix) |
| Email with mixed case | `200` — email matching is case-insensitive |

### Register
| Scenario | Expected |
|----------|----------|
| Valid new user | `201`, JWT returned, role is always `buyer` |
| Duplicate email | `409 ConflictError` |
| Password < 8 chars | `400` validation error |
| Missing name | `400` validation error |
| Attempt to register with `role: 'hub_admin'` in payload | Role ignored — always `buyer` |

### JWT Middleware
| Scenario | Expected |
|----------|----------|
| Valid Bearer token on protected route | `200` |
| No Authorization header | `401` |
| Malformed token | `401` |
| Expired token | `401` |
| Token with tampered role claim | `401` or `403` depending on route |
| Hub_staff accessing platform_admin route | `403 ForbiddenError` |

## Access Request Scenarios

### Submission
| Scenario | Expected |
|----------|----------|
| Buyer submits access request | `201`, status `pending` |
| Submit when pending already exists | `409` or appropriate conflict error |
| Submit with role = `platform_admin` | `400` — invalid role for access request |
| Submit without `organisationName` when required | `400` validation error |
| Non-buyer (already hub_staff) submits | Consider: should be blocked or allowed? Verify current behavior |

### Admin Approval
| Scenario | Expected |
|----------|----------|
| Platform admin approves pending request | `200`, user role updated, org created/linked, request status = `approved` |
| Approve non-existent request ID | `404` |
| Approve already-approved request | `409` or `400` |
| Non-admin tries to approve | `403` |
| Verify atomicity: after approval, user.role AND user.organisationId are both set | DB check |

### Admin Rejection
| Scenario | Expected |
|----------|----------|
| Platform admin rejects pending request | `200`, request status = `rejected`, user remains `buyer` |
| Reject with reason | `rejectionReason` stored in DB |
| Non-admin tries to reject | `403` |
| Reject already-rejected request | `409` or `400` |

### Reapply
| Scenario | Expected |
|----------|----------|
| Rejected buyer submits new request | `201`, new `pending` row created, old rejected row preserved |
| Rejected buyer with existing pending (edge case) | `409` — cannot have two pending |
| Approved user tries to submit new request | Define expected behavior — should be blocked |

## Test Implementation Notes

### Helper Pattern
```typescript
// Create test app and get auth token for a given role
const app = await createTestApp();
const buyerToken = await getAuthHeader(app, 'buyer');
const adminToken = await getAuthHeader(app, 'platform_admin');

// Inject a request
const res = await app.inject({
  method: 'POST',
  url: '/api/v1/access-requests',
  payload: { role: 'hub_staff', organisationName: 'Test Hub', reason: 'Testing' },
  headers: { Authorization: buyerToken },
});
expect(res.statusCode).toBe(201);
```

### DB State Verification
After approval tests, verify DB state directly:
```typescript
import { db, users, betaAccessRequests } from '@trace/db';
import { eq } from 'drizzle-orm';

const updatedUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
expect(updatedUser?.role).toBe('hub_staff');
expect(updatedUser?.organisationId).not.toBeNull();

const request = await db.query.betaAccessRequests.findFirst({ where: eq(betaAccessRequests.id, requestId) });
expect(request?.status).toBe('approved');
```

### Priority Scenarios Not Yet Covered
1. Reapply after rejection — full state transition with DB verification
2. Approval atomicity — confirm role + org set in same transaction (simulate partial failure if possible)
3. Admin reads rejection reason — verify it's not leaked to the buyer in list endpoint
4. Buyer with `null` organisationId accessing hub-only endpoints — should 403

## Pairing Notes
- **`auth-state-machine`** — reference for expected state transitions before writing tests
- **`auth-security`** — for threat-based scenarios beyond happy paths
- **`test-engineer`** — for test infrastructure, fixture patterns, and mock isolation rules
