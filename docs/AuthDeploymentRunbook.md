# TRACE Auth Fix Runbook (Staging -> Production)

This runbook implements the auth-flow fix with **same-origin `/api/*` routing** behind nginx and a staged rollout using systemd services.

## Goal

- Login requests from the web app must resolve to API endpoints on the same host.
- Browser auth traffic must never fall back to `http://localhost:3001` in staging/production.
- Staging is the release gate; production follows immediately after staging pass.

## Prerequisites

- SSH access to both servers.
- Sudo access for `nginx` and `systemctl`.
- Dedicated non-admin test user credentials for staging and production.
- Updated app build containing the frontend auth client hardening.

## Environment Contract

Set or verify:

- API service env:
  - `WEB_URL=https://trace-staging.adventurous.systems` (staging)
  - `WEB_URL=https://trace.adventurous.systems` (production)
- Web service env:
  - Leave `NEXT_PUBLIC_API_URL` **unset** for same-origin routing, or
  - Set `NEXT_PUBLIC_API_URL` to the exact web origin explicitly.

## Nginx Routing (Critical)

Add a dedicated `/api/` location in the web vhost so API calls do not reach Next.js.

Use template: `docs/nginx/trace-web.same-origin-api.conf.example`

Minimum expected behavior:

- `/api/*` -> Fastify upstream
- all non-`/api/*` -> Next.js upstream

After config changes:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Staging Rollout

1. Deploy updated web build and API build to staging.
2. Apply env updates for staging services.
3. Restart services:

```bash
sudo systemctl restart trace-api-staging
sudo systemctl restart trace-web-staging
sudo systemctl status trace-api-staging --no-pager
sudo systemctl status trace-web-staging --no-pager
```

4. Apply nginx config and reload.

### Staging Validation Checklist (must all pass)

Routing:

```bash
curl -i https://trace-staging.adventurous.systems/login
curl -i -X POST https://trace-staging.adventurous.systems/api/v1/auth/login \
  -H 'content-type: application/json' \
  --data '{"email":"invalid@example.com","password":"bad-password"}'
```

Expected:

- `/login` -> `200` HTML from Next.js.
- `/api/v1/auth/login` -> JSON response from API, typically `401`, not Next.js 404 page.

Automated smoke check:

```bash
bash scripts/auth-smoke.sh https://trace-staging.adventurous.systems
AUTH_TEST_EMAIL=<staging-test-user> AUTH_TEST_PASSWORD=<password> \
  bash scripts/auth-smoke.sh https://trace-staging.adventurous.systems
```

Functional:

1. Sign in with dedicated staging test user.
2. Confirm redirect to `/dashboard`.
3. Refresh `/dashboard` and confirm still authenticated.
4. Sign out and confirm redirect to `/login`.
5. Force invalid token in local storage and confirm protected route redirects to `/login`.

Regression:

```bash
# Replace with token from successful login response
curl -i https://trace-staging.adventurous.systems/api/v1/auth/me \
  -H "authorization: Bearer <TOKEN>"
```

Expected: `200` JSON with authenticated user payload.

Logs:

```bash
sudo journalctl -u trace-api-staging -n 200 --no-pager
sudo tail -n 200 /var/log/nginx/access.log
sudo tail -n 200 /var/log/nginx/error.log
```

## Production Rollout (Immediate After Staging Pass)

1. Apply the same nginx pattern and corresponding production upstream ports.
2. Deploy the same web/API release versions.
3. Apply production env values (`WEB_URL`, optional explicit `NEXT_PUBLIC_API_URL`).
4. Restart services:

```bash
sudo systemctl restart trace-api
sudo systemctl restart trace-web
sudo systemctl status trace-api --no-pager
sudo systemctl status trace-web --no-pager
```

5. Run abbreviated smoke checks:
   - `/login` returns `200`.
   - invalid login to `/api/v1/auth/login` returns API JSON `401` (not Next.js 404).
   - valid login with dedicated production test user reaches `/dashboard`.
   - `/api/v1/auth/me` works with returned token.
   - `bash scripts/auth-smoke.sh https://trace.adventurous.systems` (with and without credentials).

## Rollback

If auth fails after deployment:

1. Revert nginx vhost to previous known-good config and reload nginx.
2. Revert web service to previous release and restart `trace-web*`.
3. Revert API service only if API regressions are observed.
4. Re-run the routing checks to confirm rollback success.
