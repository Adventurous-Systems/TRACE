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

Both environments run through nginx and Docker Compose, on the **same VPS** but as
fully isolated Compose projects (`trace` vs `trace-staging`) — separate volumes,
networks, and containers for every service (Postgres, Redis, MinIO, thor-solo,
Meilisearch). Nothing is shared at the data layer.

Host ports are **not hardcoded per branch**: `docker-compose.yml` is identical on
both branches and reads ports from each environment's `.env`
(`API_HOST_PORT`, `WEB_HOST_PORT`, `POSTGRES_HOST_PORT`, … — defaults are the
production values). This is what lets `main` and `staging` share one compose file
without diverging. The table above is the effective mapping per environment.

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
- **`main` only ever fast-forwards from `staging`** — no direct commits, no merge commits into `main`. This is what keeps the two branches from diverging (see Phase 3).
- Never treat the VPS checkout as the primary working copy
- Always open Pull Requests through GitHub for `feature/* → staging`

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

### Phase 3: Promote to production (fast-forward)

Only after staging is approved.

**`main` is promoted by fast-forwarding it to `staging`'s exact commit — never by a merge commit.** This keeps `main` and `staging` pointing at the same SHA after every release, so they never show up as "diverged" (the ahead-*and*-behind split that merge-commit promotions cause).

```bash
git checkout main
git fetch origin
git merge --ff-only origin/staging   # main jumps to staging's tip — no merge commit
git push origin main                 # → production auto-deploys
```

GitHub Actions will deploy `main` to:
- `/opt/TRACE`
- `https://trace.adventurous.systems`

After this, `main == staging` (identical SHA). During the next round of development `main` is simply *behind* `staging` — that is the normal promote-from-staging state, not divergence.

`--ff-only` only works if `main` has **no commits of its own**. That is the whole point: never commit to `main` directly, never merge into `main` with a merge commit. Everything reaches `main` by fast-forward from `staging`. (If `--ff-only` is ever rejected, `main` has drifted — reconcile by bringing the stray work onto `staging` first, then fast-forward again.)

> Note on branch protection: a true fast-forward is a direct push, which the GitHub PR "Merge" button cannot do (it always writes a merge or rebase commit). So production promotion is an **admin fast-forward push**, not a PR merge. Keep `main` protected against non-admin/force pushes, but allow the admin fast-forward.

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

These repository secrets are **configured** (2026-06-03) and both pipelines deploy automatically:

- `TRACE_STAGING_SSH_HOST` / `_USER` / `_KEY`
- `TRACE_PRODUCTION_SSH_HOST` / `_USER` / `_KEY`

Each environment uses a dedicated CI deploy key (`trace-staging-ci-deploy`,
`trace-prod-ci-deploy`) whose public key is in the VPS `authorized_keys`; the
private key lives only in the GitHub secret.

> Deploys occasionally fail with `dial tcp …:22 i/o timeout` — intermittent
> upstream packet loss between the GitHub runner and the VPS (ruled out
> MaxStartups/ufw/conntrack/load). A failed run changes nothing on the server
> (SSH never connects); just re-run the workflow.

---

## 8. Emergency Hotfix Flow

Hotfixes must still reach production **through `staging`**, so the fast-forward
relationship (Phase 3) is preserved — never commit a fix straight onto `main`.

1. branch from `staging`: `git checkout staging && git pull && git checkout -b hotfix/<issue-name>`
2. fix and test
3. PR `hotfix/<issue-name>` → `staging`, merge, verify on staging
4. fast-forward `main` to `staging` and push (Phase 3) → production deploys

If the emergency is so severe you must work from `main` directly, branch from
`main`, fix, then land the commit on `staging` first (`git checkout staging &&
git merge --ff-only hotfix/...`) and fast-forward `main` from `staging`. Do **not**
merge the hotfix into `main` independently — that recreates the divergence.

---

## 9. Practical Team Rule

If a change exists only on a VPS and not in GitHub, it is not finished.
