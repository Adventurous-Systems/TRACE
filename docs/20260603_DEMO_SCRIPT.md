# TRACE — Workshop Demo Script (June 8, 2026)

Step-by-step run sheet for the live demo + group testing session. Flows here are
**verified** against the deployed environments (15/15 smoke test, 2026-06-03).

> **Blockchain note:** anchoring is intentionally **off** for the workshop
> (`MATERIAL_REGISTRY_ADDRESS` unset). The integrity-proof plumbing is built and
> production-ready; on-chain anchoring goes live in a post-workshop step. **Do not
> claim passports are "anchored on VeChain" during the demo** — frame it as
> "integrity proof ready; on-chain verification switches on after the pilot."

---

## Environments

| | URL | Use |
|---|---|---|
| **Production** | https://trace.adventurous.systems | Primary — run the demo + group testing here |
| **Staging** | https://trace-staging.adventurous.systems | Fallback if prod has any issue |

Both are live and identical in code. If prod has a hiccup mid-session, switch the group to staging — same credentials, same flows.

---

## Login credentials (seeded)

| Role | Email | Password | Used for |
|---|---|---|---|
| Platform admin | `platform@trace.eco` | `Platform1234!` | Approving access requests, viewing feedback |
| Hub admin | `admin@stirlingreuse.com` | `Admin1234!` | Hub oversight |
| Hub staff | `staff@stirlingreuse.com` | `Staff1234!` | Creating passports + listings |
| Inspector | `inspector@trace.eco` | `Inspector1234!` | Quality reports |
| Buyer | `buyer@example.com` | `Buyer1234!` | Browsing marketplace, making offers |

**Org:** Stirling Reuse Hub (verified). **Seeded passports:** Reclaimed Victorian
Red Brick (active, grade B), Steel I-Beam 203×133×25 UB (listed, grade A), Natural
Welsh Slate Roofing (draft, grade C).

> ⚠️ Reset/clean any test data created during rehearsal before the live session
> (or re-run `pnpm --filter @trace/db seed`). Don't demo on top of accumulated junk.

---

## Pre-demo checklist (morning of)

- [ ] `https://trace.adventurous.systems` loads; log in as platform admin succeeds
- [ ] All three seeded passports visible; QR image on a passport loads (open it in a tab)
- [ ] Feedback button (bottom-right) opens on a dashboard page
- [ ] Staging fallback also loads
- [ ] Projector/screen shows the browser at a readable zoom; have the credentials table open

---

## Part 1 — Live demo (≈10 min, presenter-driven)

Narrate the circular-economy story while walking the core loop end-to-end.

1. **Frame it (30s).** "TRACE issues EU-DPP-style digital passports for reclaimed
   construction materials, so a buyer can trust what they're getting and where it came from."

2. **Hub staff registers a material** — log in as **hub staff**.
   - Create a passport (e.g. a reclaimed steel beam): product name, category, condition grade, dimensions.
   - **Upload a condition photo** — show it appears in the gallery.
   - Show the generated **QR code** and open the **public passport page** (scan the QR with a phone, or open the link) — "anyone can verify this without an account."

3. **List it on the marketplace** — still as hub staff, create a listing (price, quantity, collection/delivery).

4. **Buyer discovers + offers** — log in as **buyer** (second browser/incognito).
   - Browse the marketplace, use a category/condition filter.
   - Make an offer on the listing → a **transaction** is created.
   - *(Note: an offer creates the transaction directly — there's no separate seller "accept" step.)*

5. **Inspector adds a quality report** — log in as **inspector**, submit a report (structural/aesthetic/environmental scores + grade) against the passport.

6. **Close the loop** — back as **buyer**, confirm delivery on the transaction (`pending → confirmed`).

7. **Access governance (brief)** — log in as **platform admin**, show `/admin/access-requests`
   (this is how new hubs/staff are vetted — *platform admin* approves, not hub admin).

---

## Part 2 — Group testing (≈25 min)

Split attendees into groups. Each group walks the same loop and is encouraged to
try to break it. Suggested per-group path:

1. **Sign up** as a new buyer at `/register` → submit an **access request** at `/access-request` (request hub_staff).
2. A facilitator (as **platform admin**) **approves** the request at `/admin/access-requests`.
3. The newly-elevated user **creates a passport** + uploads a photo + views the public QR page.
4. Creates a **listing**; another group (as buyer) **makes an offer**.
5. **Inspector** submits a quality report.
6. Everyone **submits feedback** via the bottom-right widget (rating + category + comment).

Facilitators circulate, unblock, and note pain points.

---

## Part 3 — Feedback capture & wrap (≈10 min)

- Every dashboard page has the **Feedback** button (bottom-right): 5-star rating,
  category (bug / ux / feature / general), free-text. It works **with or without login**.
- Platform admin reviews submissions live at **`/admin/feedback`** (summary cards +
  full list) — show the group their input landing in real time.
- Wrap: thank attendees, point them to the WhatsApp community group, outline next steps.

---

## If something breaks

- **Prod issue:** switch the group to `https://trace-staging.adventurous.systems` (same logins).
- **A page errors:** hard-refresh; check you're logged in as the right role (e.g. only
  *platform admin* can approve access requests / view feedback; only *hub staff/admin*
  create passports & listings; only *inspector/hub admin/platform admin* file quality reports).
- **QR image doesn't load:** it's served from `…/minio/…` — confirmed working on both envs.
- **Deploy/infra:** don't redeploy during the session; both envs are already on the current build.
