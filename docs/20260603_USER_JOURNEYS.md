# TRACE User Journeys

Date: 2026-06-03
Source branch: `staging`
Source commit: `dc7f739`

This document describes the current staging user journeys in plain language for workshop facilitators, product planning, and stakeholder review. For the technical route/API map, see `docs/20260603_USER_FLOWS.md`.

## Product Journey Overview

TRACE currently supports a workshop-ready loop:

1. A public visitor discovers TRACE and browses reclaimed materials.
2. A buyer creates an account and can make offers on listed materials.
3. A buyer who wants seller/hub access requests an elevated role.
4. A platform admin reviews and approves or rejects that request.
5. Hub staff register materials as digital passports.
6. Hub staff list active materials in the marketplace.
7. Buyers place offers, creating internal order records.
8. Inspectors submit quality reports.
9. Users submit in-app feedback during testing.
10. Platform admins monitor feedback, activity, and blockchain readiness.

For the June 8 workshop, blockchain anchoring is intentionally not live. `MATERIAL_REGISTRY_ADDRESS` should remain unset, so passport certificates may stay pending or show local/off-chain status.

## Journey 1: Public Visitor Discovers TRACE

### User

A construction-sector attendee, buyer, facilitator, or member of the public.

### Goal

Understand what TRACE does, browse reusable materials, and verify a material passport from a QR code.

### Entry Points

| Entry | User Intent |
|---|---|
| `/` | Learn what TRACE is |
| `/marketplace` | Browse available materials |
| `/scan` | Scan a QR code from a physical/demo material |
| `/passport/:id` | Inspect a material passport |

### Journey

1. Visitor lands on the TRACE home page.
2. Visitor chooses either to create an account or scan a QR code.
3. If browsing, visitor opens the marketplace.
4. Visitor searches or filters by category and condition grade.
5. Visitor opens a listing and reviews price, quantity, supplier hub, condition notes, carbon savings, and the public passport link.
6. Visitor opens the passport page or scans a QR code.
7. Visitor sees passport details and certificate status.

### Happy Path Outcome

The visitor understands what the material is, who supplied it, what condition it is in, and whether it has verification metadata.

### Friction Points

| Moment | Current Reality |
|---|---|
| Blockchain confidence | Testnet anchoring is not live for the workshop |
| Marketplace trust | Quality reports and condition notes help, but there is no payment or escrow |
| QR asset URLs | Public asset URL configuration must be correct on staging/production |

### Success Signals

- Visitor can open marketplace without signing in.
- Visitor can view a public active passport.
- QR scan routes to the correct passport.
- Certificate status is understandable even when pending.

## Journey 2: Buyer Creates an Account and Browses Materials

### User

A potential buyer looking for reclaimed construction materials.

### Goal

Create a buyer account, browse listed materials, and make an offer.

### Entry Points

| Entry | User Intent |
|---|---|
| `/register` | Create account |
| `/login` | Return to account |
| `/marketplace` | Browse materials |
| `/marketplace/:id` | Inspect and make offer |
| `/transactions` | Track order status |

### Journey

1. Buyer clicks "Get started" or opens `/register`.
2. Buyer enters name, email, and password.
3. TRACE creates a `buyer` account only.
4. Buyer lands on `/marketplace`.
5. Buyer searches for material and opens a listing.
6. Buyer adds an optional note to the seller.
7. Buyer makes an offer.
8. TRACE creates a transaction in `pending` status and reserves the listing/passport.
9. Buyer opens `/transactions`.
10. Buyer can confirm delivery, flag dispute, or cancel while the order is pending/confirmed.

### Happy Path Outcome

Buyer creates an account and starts an internal order/reservation flow.

### Friction Points

| Moment | Current Reality |
|---|---|
| Account creation | No email verification |
| Offer language | UI says offer/order, but there is no payment flow |
| Seller notification | There is no email/messaging provider implemented |
| Transaction detail security | List is scoped, but single transaction read needs ownership hardening |

### Success Signals

- Buyer signup always returns role `buyer`.
- Buyer can make an offer on an active listing.
- Listing moves out of active marketplace availability once reserved.
- Buyer sees the order in `/transactions`.

## Journey 3: Buyer Requests Seller or Hub Access

### User

A buyer who wants to act as a seller, hub staff member, or hub admin.

### Goal

Request elevated access without directly assigning their own role.

### Entry Points

| Entry | User Intent |
|---|---|
| `/access-request` | Request seller/hub access |
| `/marketplace` | Buyer sees request seller access CTA |

### Journey

1. Buyer signs in.
2. Buyer opens `/access-request`.
3. TRACE loads the buyer's previous requests.
4. If no request is pending, buyer chooses `hub_staff` or `hub_admin`.
5. Buyer enters organisation or hub name and optional context.
6. Buyer submits.
7. TRACE stores a pending access request.
8. Buyer sees pending status and cannot submit a duplicate pending request.
9. If rejected or later revoked, buyer can submit a fresh request.

### Happy Path Outcome

Buyer has a pending access request ready for platform admin review.

### Friction Points

| Moment | Current Reality |
|---|---|
| Request review | Only platform admin can approve/reject |
| Buyer communication | No email notification when status changes |
| Self-service | Buyer cannot withdraw or edit request directly |

### Success Signals

- Buyer cannot self-select an elevated role during signup.
- Buyer can submit exactly one pending request.
- Request history remains visible.

## Journey 4: Platform Admin Reviews Access

### User

TRACE operator or platform admin.

### Goal

Review requests, approve trusted users, manage organisations, and revoke access when needed.

### Entry Points

| Entry | User Intent |
|---|---|
| `/admin/access-requests` | Review pending requests and manage access |

### Journey

1. Platform admin signs in.
2. Admin opens `/admin/access-requests`.
3. Admin reviews three views: pending requests, approved access, and organisations.
4. For pending requests, admin can edit role, organisation name, notes, and review notes.
5. Admin approves or rejects.
6. On approval, admin links user to existing organisation or creates/reuses a hub by name.
7. User role becomes `hub_staff` or `hub_admin`.
8. Admin can later change role, reassign organisation, or revoke access back to `buyer`.
9. Admin can rename organisations and toggle verified status.

### Happy Path Outcome

The right users get the right role and organisation, with request history preserved.

### Friction Points

| Moment | Current Reality |
|---|---|
| Hub admin role | Hub admin cannot approve access requests |
| Organisation model | Rename and verified toggle only, no full org profile editor |
| Auditability | Audit events exist, but production review process still needs operational discipline |

### Success Signals

- Platform admin can approve a buyer into hub staff.
- Newly approved user can access hub dashboard.
- Revoked user returns to buyer state and can reapply.

## Journey 5: Hub Staff Registers a Material Passport

### User

Hub staff at Stirling Reuse Hub.

### Goal

Register a reclaimed material with enough data for public inspection, marketplace listing, and future blockchain anchoring.

### Entry Points

| Entry | User Intent |
|---|---|
| `/dashboard` | See operational overview |
| `/passports/new` | Register material |
| `/passports` | Review inventory |
| `/passports/:id` | Manage a passport |

### Journey

1. Hub staff signs in.
2. Staff lands on `/dashboard`.
3. Staff clicks "Register material".
4. Wizard collects basic identity, material specs, circular data, environmental data, and review.
5. Staff submits.
6. TRACE creates a passport under the staff member's organisation.
7. TRACE generates a public QR code and stores it in MinIO.
8. Passport becomes `active`.
9. TRACE records a passport event and queues anchoring.
10. Wizard shows certificate/verification status.

### Happy Path Outcome

The material is visible in hub inventory and can be listed for sale.

### Friction Points

| Moment | Current Reality |
|---|---|
| Long form | Wizard persists draft values in browser localStorage |
| Blockchain status | Anchoring queue will fail while `MATERIAL_REGISTRY_ADDRESS` is unset |
| Data completeness | Some fields are optional for demo speed |

### Success Signals

- New passport appears in `/passports`.
- Public `/passport/:id` URL works.
- QR asset resolves.
- Passport status is `active`.

## Journey 6: Hub Staff Uploads Photos and Lists Material

### User

Hub staff preparing a material for reuse marketplace.

### Goal

Add condition evidence and create a public listing.

### Entry Points

| Entry | User Intent |
|---|---|
| `/passports/:id` | Upload condition photos |
| `/listings/new?passportId=:id` | Create listing from active passport |
| `/listings` | Manage hub listings |

### Journey

1. Hub staff opens a passport detail page.
2. Staff uploads condition photo.
3. TRACE stores the photo in MinIO and appends the URL to the passport.
4. Staff clicks "List for sale" from active passport.
5. Staff chooses price, quantity, and shipping method.
6. TRACE creates an active listing.
7. Passport status changes to `listed`.
8. Listing appears in `/marketplace`.
9. Staff can cancel a listing, which returns passport to `active`.

### Happy Path Outcome

Material is publicly listed with price, condition, carbon, and supplier context.

### Friction Points

| Moment | Current Reality |
|---|---|
| Upload validation | MIME and file-size checks exist, but no image content scan |
| Listing stock | Quantity exists, but there is no multi-unit inventory decrement flow |
| Seller notification | No notification system yet |

### Success Signals

- Photo displays on passport detail.
- Listing appears publicly.
- Passport status changes from `active` to `listed`.

## Journey 7: Buyer Makes an Offer and Tracks Order

### User

Buyer acquiring reclaimed material.

### Goal

Reserve a listed material and track delivery/issue status.

### Entry Points

| Entry | User Intent |
|---|---|
| `/marketplace/:id` | Make offer |
| `/transactions` | Track orders |

### Journey

1. Buyer opens a listing.
2. Buyer reviews condition, supplier, price, and public passport.
3. Buyer makes an offer.
4. TRACE creates a transaction with `pending` status.
5. TRACE reserves the listing and material passport.
6. Buyer sees order under `/transactions`.
7. Buyer confirms delivery after receiving material.
8. If needed, buyer flags dispute or buyer/seller cancels.

### Happy Path Outcome

Order reaches `confirmed`, and later can be completed by lifecycle rules.

### Friction Points

| Moment | Current Reality |
|---|---|
| Payment | None implemented |
| Seller accept | Offer creates transaction directly, no separate seller accept step |
| Delivery logistics | Stored as shipping options/notes only |

### Success Signals

- Transaction appears for buyer.
- Buyer-only actions show correctly.
- Cancel restores listing and passport availability.

## Journey 8: Inspector Submits Quality Report

### User

Quality inspector, hub admin, or platform admin.

### Goal

Record a condition assessment against a material passport.

### Entry Points

| Entry | User Intent |
|---|---|
| `/quality` | Review own reports |
| `/quality/new` | Submit report |
| `/quality/new?passportId=:id` | Submit report for known passport |
| `/passports/:id` | View reports attached to passport |

### Journey

1. Inspector signs in.
2. Inspector opens `/quality/new`.
3. Inspector enters passport id.
4. Inspector scores structural, aesthetic, and environmental quality.
5. UI suggests a grade based on average score.
6. Inspector selects or confirms overall grade and adds notes.
7. TRACE creates a quality report.
8. Passport condition grade updates if grade is provided.
9. Report appears in inspector list and passport detail.

### Happy Path Outcome

Passport now has visible quality evidence and a condition grade.

### Friction Points

| Moment | Current Reality |
|---|---|
| Passport lookup | Form needs passport id; no picker in current UI |
| Evidence upload | Report `photoUrls` exist, but report photo upload UI is not implemented |
| Dispute control | Any authenticated user can currently dispute any report |

### Success Signals

- Report appears in `/quality`.
- Passport detail shows the report.
- Public readers can see quality information for the passport.

## Journey 9: Workshop User Submits Feedback

### User

Any authenticated dashboard user during group testing.

### Goal

Give structured product feedback from inside the app.

### Entry Points

| Entry | User Intent |
|---|---|
| Floating "Feedback" button | Submit page-specific feedback |
| `/admin/feedback` | Admin review |

### Journey

1. User works through demo or testing task.
2. User clicks the feedback button.
3. User selects rating, category, and message.
4. TRACE captures the current page URL.
5. Feedback is submitted.
6. Platform admin or hub admin opens `/admin/feedback`.
7. Admin reviews average score, category counts, and individual submissions.

### Happy Path Outcome

Workshop feedback is stored in the database and reviewable in the admin UI.

### Friction Points

| Moment | Current Reality |
|---|---|
| Public endpoint | Feedback API accepts anonymous submissions too |
| Follow-up | No email notification or assignment workflow |
| Analysis | Summary cards are simple, no export yet |

### Success Signals

- Feedback submit returns success.
- Feedback appears in admin list.
- Page URL identifies where user was when submitting.

## Journey 10: Platform Admin Monitors Activity and Blockchain Readiness

### User

Platform admin or technical operator.

### Goal

Understand recent system activity and whether blockchain-related infrastructure is healthy.

### Entry Points

| Entry | User Intent |
|---|---|
| `/admin/activity` | Review audit and blockchain transaction state |
| `/explorer/tx/:txHash` | Inspect transaction detail |

### Journey

1. Platform admin signs in.
2. Admin opens `/admin/activity`.
3. Page loads recent audit events.
4. Page loads recent blockchain transaction logs and VTHO summary.
5. Admin checks gas payer status and failures.
6. If a transaction hash exists, admin or public viewer can inspect it in the mini explorer.

### Happy Path Outcome

Admin can diagnose recent changes and blockchain transaction attempts.

### Friction Points

| Moment | Current Reality |
|---|---|
| Workshop mode | Anchoring intentionally off, so failures/pending states may be expected |
| Testnet readiness | Contract tests/typecheck still need fixes before go-live |
| Monitoring depth | No external alerting service implemented |

### Success Signals

- Admin page loads audit events.
- Blockchain summary loads without leaking secrets.
- Gas payer status is readable.

## Workshop Facilitation Journey

Use this journey when running a June 8 group testing session.

### Demo Setup

1. Confirm staging or production URL is live.
2. Confirm migrations are applied.
3. Confirm seeded accounts exist.
4. Confirm `MATERIAL_REGISTRY_ADDRESS` remains unset for workshop mode.
5. Confirm QR/photo public assets resolve.
6. Keep platform admin credentials ready for access approvals.

### Suggested Live Demo

1. Open public marketplace as a visitor.
2. View the listed Steel I-Beam.
3. Open its public passport.
4. Log in as hub staff.
5. Register a new material passport.
6. Upload a condition photo.
7. List the material for sale.
8. Log in as buyer.
9. Make an offer.
10. Open orders and confirm delivery.
11. Log in as inspector.
12. Submit a quality report.
13. Submit feedback through the widget.
14. Log in as platform admin.
15. Review feedback and activity.

### Group Testing Tasks

| Group | Task |
|---|---|
| Buyers | Browse marketplace, inspect a passport, make an offer, submit feedback |
| Hub users | Register a material, upload a photo, create a listing, submit feedback |
| Inspectors | Submit a quality report and check public visibility |
| Admins/facilitators | Approve an access request, review feedback, inspect activity |

### Facilitator Notes

- Explain that offers are reservations, not paid transactions.
- Explain that blockchain testnet anchoring is post-workshop.
- Use `platform_admin` for access approvals.
- If QR/certificate status is pending, that is expected in workshop mode.
- Capture confusion in the feedback widget rather than trying to fix workflow wording live.

## Current Journey Gaps

| Gap | User Impact | Priority |
|---|---|---|
| No live payment/checkout | Buyers cannot complete real purchase | High before production marketplace |
| No seller accept step | Seller does not actively accept offer | Medium |
| No notifications | Users must check app manually | Medium |
| No email verification | Account identity assurance is low | Medium |
| No invite workflow | Hub onboarding depends on admin review | Medium |
| Report photo upload missing | Quality evidence is less complete | Medium |
| Blockchain anchoring off for workshop | Public proof is pending/local | Accepted for workshop |
| Feedback has no export/triage | Workshop analysis is manual | Low |

