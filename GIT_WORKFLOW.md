# TRACE Git, GitHub, and Deployment Workflow

This document defines the standard development and release flow for TRACE.

The goal is simple:
- `trace-staging.adventurous.systems` is where we test changes first
- `trace.adventurous.systems` is the public production environment
- GitHub is the source of truth
- VPS checkouts should never become long-lived forks of the repo

---

## 1. Environment Map

| Environment | Domain | Branch | Server Path | Web Port | API Port |
| --- | --- | --- | --- | --- | --- |
| Production | `trace.adventurous.systems` | `main` | `/opt/TRACE` | `3003` | `3004` |
| Staging | `trace-staging.adventurous.systems` | `staging` | `/opt/TRACE-staging` | `4003` | `4004` |

Both environments run through nginx and Docker Compose.

---

## 2. Branch Strategy

Use three branch types:

1. `main`
   Production-ready code only.

2. `staging`
   The shared integration branch for features, fixes, and QA.

3. `feature/*`, `fix/*`, `hotfix/*`
   Short-lived working branches created from `staging` unless there is a true production emergency.

Rules:
- Never develop directly on `main`
- Never develop directly on `staging`
- Never treat the VPS checkout as the primary working copy
- Always open Pull Requests through GitHub

---

## 3. Standard Delivery Flow

### Phase 1: Build the change

Start from the latest `staging` branch:

```bash
git checkout staging
git pull origin staging
git checkout -b feature/my-change
```

Make the change locally, then run the checks that are relevant to the work.

Commit and push your feature branch:

```bash
git add .
git commit -m "feat: add my change"
git push -u origin feature/my-change
```

### Phase 2: Ship to staging

Open a Pull Request:

- base: `staging`
- compare: `feature/my-change`

After review, merge into `staging`.

GitHub Actions will deploy `staging` to:
- `/opt/TRACE-staging`
- `https://trace-staging.adventurous.systems`

Then perform manual QA in staging.

Recommended staging QA for auth and access work:
- buyer signup at `/register`
- buyer request submission at `/access-request`
- platform admin review at `/admin/access-requests`
- pending request edit and approval
- organisation rename and verified toggle
- approved-user role change, organisation reassignment, and revoke
- buyer reapply flow after revoke or rejection

### Phase 3: Promote to production

Only after staging is approved:

Open a Pull Request:

- base: `main`
- compare: `staging`

After review, merge into `main`.

GitHub Actions will deploy `main` to:
- `/opt/TRACE`
- `https://trace.adventurous.systems`

---

## 4. Server Deployment Contract

The deploy workflows use the same pattern in both environments:

```bash
git fetch origin
git checkout <branch>
git reset --hard origin/<branch>
docker compose up -d postgres redis thor-solo minio meilisearch
docker compose run --rm --build api pnpm --filter @trace/db migrate
docker compose up -d --build api web
```

Important:
- the server worktree must not contain hand-edited changes
- deployment is expected to pull from GitHub, not preserve local-only edits
- if a hotfix is made directly in production during an incident, it must be committed and merged back properly right away

---

## 5. CI Expectations

Every Pull Request should pass CI before merge.

Current CI responsibilities:
- install dependencies
- build the monorepo
- run API tests against PostgreSQL and Redis

Staging and production deploy automatically only from their dedicated branches.

---

## 6. Branch Protection Recommendations

In GitHub settings, enable branch protection for:
- `staging`
- `main`

Recommended rules:
- require Pull Requests before merging
- require status checks to pass
- block force pushes
- block direct pushes for non-admins

---

## 7. GitHub Actions Secrets

Configure these repository secrets before enabling automatic deploys:

- `TRACE_STAGING_SSH_HOST`
- `TRACE_STAGING_SSH_USER`
- `TRACE_STAGING_SSH_KEY`
- `TRACE_PRODUCTION_SSH_HOST`
- `TRACE_PRODUCTION_SSH_USER`
- `TRACE_PRODUCTION_SSH_KEY`

The SSH key should allow deployment access to the relevant server checkout.

---

## 8. Emergency Hotfix Flow

If production has a critical issue:

1. branch from `main`
2. create `hotfix/<issue-name>`
3. fix and test
4. open PR into `main`
5. deploy production
6. immediately merge the same fix back into `staging`

This prevents production and staging from drifting apart.

---

## 9. Practical Team Rule

If a change exists only on a VPS and not in GitHub, it is not finished.
