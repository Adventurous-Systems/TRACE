# TRACE Auth and Access Deployment Runbook

This runbook covers the current public auth and access-management rollout for TRACE.

It includes:
- same-origin `/api/*` routing behind nginx
- buyer-only public signup
- buyer access-request flow
- platform-admin review and management flow
- staging-first release verification before production

## Goal

- Login requests from the web app must resolve to API endpoints on the same host.
- Browser auth traffic must never fall back to `http://localhost:3001` in staging or production.
- Public signup must create `buyer` accounts only.
- Buyers must be able to request seller or beta access without choosing their own elevated role.
- `platform_admin` must be able to review, edit, approve, reassign, and revoke access from `/admin/access-requests`.
- Revoked buyers must be able to reapply from the beginning.

## Prerequisites

- SSH access to both servers.
- Sudo access for `nginx` and `systemctl` when using a systemd deployment.
- Docker Compose access for the current TRACE staging and production stacks.
- Dedicated non-admin test user credentials for staging and production.
- Platform-admin credentials for admin review validation.
- Updated app build containing the frontend auth client hardening and access-management pages.

## Environment Contract

Set or verify:

- API service env:
  - `WEB_URL=https://trace-staging.adventurous.systems` for staging
  - `WEB_URL=https://trace.adventurous.systems` for production
- Web service env:
  - leave `NEXT_PUBLIC_API_URL` unset for same-origin routing, or
  - set `NEXT_PUBLIC_API_URL` to the exact web origin explicitly

## Nginx Routing

Add a dedicated `/api/` location in the web vhost so API calls do not reach Next.js.

Use template: `docs/nginx/trace-web.same-origin-api.conf.example`

Minimum expected behavior:
- `/api/*` routes to Fastify
- all non-`/api/*` routes go to Next.js

After config changes:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Staging Rollout

1. Deploy updated web and API builds to staging.
2. Apply env updates for staging services.
3. Restart or rebuild the relevant services.
4. Apply nginx config and reload.

### Staging Validation Checklist

Routing:

```bash
curl -i https://trace-staging.adventurous.systems/login
curl -i -X POST https://trace-staging.adventurous.systems/api/v1/auth/login \
  -H 'content-type: application/json' \
  --data '{"email":"invalid@example.com","password":"bad-password"}'
```

Expected:
- `/login` returns `200` HTML from Next.js
- `/api/v1/auth/login` returns API JSON, typically `401`, not a Next.js 404 page

Public auth:
1. Register a new user at `/register`
2. Confirm the returned or stored role is `buyer`
3. Confirm a buyer lands in `/marketplace` after sign-in

Buyer access-request flow:
1. Open `/access-request` as a buyer
2. Submit a request for `hub_staff` or `hub_admin`
3. Confirm the page shows the active `pending` request
4. Reject or revoke the user later and confirm the buyer can submit a fresh request again

Platform-admin flow:
1. Sign in as `platform@trace.eco`
2. Open `/admin/access-requests`
3. Confirm the three views load:
   - pending requests
   - approved access
   - organisations
4. Edit a pending request and approve it
5. Approve with either:
   - an existing organisation, or
   - a custom organisation name that creates a new hub organisation
6. In approved access, verify:
   - role change between `hub_staff` and `hub_admin`
   - organisation reassignment
   - revoke back to `buyer`
7. In organisations, verify:
   - organisation rename
   - verified toggle

Regression:

```bash
curl -i https://trace-staging.adventurous.systems/api/v1/auth/me \
  -H "authorization: Bearer <TOKEN>"
```

Expected: `200` JSON with the authenticated user payload.

Logs:

```bash
sudo journalctl -u trace-api-staging -n 200 --no-pager
sudo tail -n 200 /var/log/nginx/access.log
sudo tail -n 200 /var/log/nginx/error.log
```

## Production Rollout

Only after staging passes:

1. Apply the same nginx pattern and corresponding production upstream ports.
2. Deploy the same web and API release versions.
3. Apply production env values.
4. Restart or rebuild production services.
5. Re-run an abbreviated version of the staging validation checklist.

Minimum production checks:
- `/login` returns `200`
- invalid login to `/api/v1/auth/login` returns API JSON `401`
- buyer signup still creates `buyer`
- `/access-request` works for a test buyer
- `/admin/access-requests` loads for `platform_admin`
- revoke and reapply flow still works
- `/api/v1/auth/me` works with a valid token

## Rollback

If auth or access management fails after deployment:

1. Revert nginx vhost to the previous known-good config and reload nginx.
2. Revert web service to the previous release and restart it.
3. Revert API service only if API regressions are observed.
4. Re-run the routing and auth checks to confirm rollback success.

## Notes

Current intentional constraints:
- self-signup is buyer-only
- elevated roles are not self-service
- requests and organisations are not hard-deleted
- revocation preserves history but should not block a buyer from reapplying
