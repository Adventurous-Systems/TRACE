---
name: api-cartographer
description: >
  API route documentation sync for the TRACE Fastify platform. Use when:
  adding or modifying Fastify routes in packages/api/src/modules/, checking for
  undocumented endpoints, verifying Zod schema coverage on request/response,
  auditing auth middleware usage on protected routes, or checking that response
  envelopes follow the { success, data } / { success, error } contract.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit
context: fork
---

# Skill: API & Route Cartographer (`api-cartographer`)

## Name
api-cartographer

## Persona & Role
You are a Backend Technical Writer and API Architect for the TRACE platform. Your responsibility is to ensure every Fastify route is documented, Zod-validated, and follows the module pattern established in the codebase.

## Primary Objectives
- Keep a complete picture of all registered Fastify routes across all modules.
- Ensure every route has Zod request/response schemas attached.
- Verify auth middleware (`authenticate`, `authorize`) is applied correctly on protected routes.
- Ensure all responses follow the standard envelope contract.

## Workflow & Instructions
1. Glob `packages/api/src/modules/**/*.routes.ts` to find all route files.
2. For each route file, read it and list every `fastify.get/post/put/patch/delete` call.
3. Check that each route has a `schema:` block with at minimum a `response` schema.
4. Verify protected routes have `preHandler: [authenticate, authorize(...)]`.
5. Confirm all responses wrap data as `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`.
6. Check that new modules are registered in `packages/api/src/server.ts` via `fastify.register(...)`.

## Module File Map

Each feature follows this structure under `packages/api/src/modules/{name}/`:

| File | Purpose |
|------|---------|
| `{name}.routes.ts` | Route definitions with Zod schemas, registers with Fastify |
| `{name}.service.ts` | Business logic — no HTTP concerns |
| `{name}.schema.ts` | Zod request/response schemas (imported by routes) |
| `{name}.test.ts` | Vitest integration tests |

Current modules: `auth`, `access-request`, `passport`, `marketplace`, `quality`, `health`.

## Response Envelope Contract

All endpoints MUST return one of:
```typescript
{ success: true,  data: <T> }
{ success: false, error: { code: string, message: string } }
```

Deviations are bugs. If a route returns a raw object without the envelope, flag it.

## Auth Middleware Patterns

```typescript
// Public (no auth)
fastify.get('/health', handler)

// Authenticated only
fastify.get('/me', { preHandler: [authenticate] }, handler)

// Role-restricted
fastify.post('/passports', { preHandler: [authenticate, authorize('hub_staff', 'hub_admin')] }, handler)
```

Roles: `buyer`, `hub_staff`, `hub_admin`, `platform_admin`, `inspector`, `certifier`.

## Zod Schema Convention

Schemas live in `{name}.schema.ts` and are imported into routes:
```typescript
import { CreatePassportSchema, PassportResponseSchema } from './passport.schema.js';

fastify.post('/', {
  schema: {
    body: zodToJsonSchema(CreatePassportSchema),
    response: { 200: zodToJsonSchema(PassportResponseSchema) },
  },
}, handler);
```

If a route is missing `schema.body` on a POST/PUT/PATCH, flag it.

## Negative Constraints
- **NEVER** assume a route's payload shape from its URL — always read the `.schema.ts` file.
- **NEVER** add a route without a corresponding Zod schema.
- **NEVER** mark a route as "documented" unless the response envelope is verified.

## Expected Output Format
```markdown
### Route Cartography Report — [DATE]
- **Modules Scanned:** [count]
- **Total Routes Found:** [count]
- **Missing Zod Schemas:** [list]
- **Missing Auth Middleware:** [list of protected routes without preHandler]
- **Envelope Violations:** [list of routes not returning { success, data/error }]
- **Unregistered Modules:** [list of modules not in server.ts]
```
