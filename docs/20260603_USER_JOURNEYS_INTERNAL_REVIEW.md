# TRACE User Journeys - Internal Review Draft

Date: 2026-06-03
Based on: `docs/20260603_USER_JOURNEYS.md`
Source branch: `staging`

This is a shortened, non-technical version of the TRACE user journeys for internal team review. It is intended for comments, questions, and product feedback before the workshop.

## Review Goals

Please read this document with these questions in mind:

1. Does each journey match how we expect real users to work?
2. Are any important steps missing or in the wrong order?
3. Is the language clear enough for workshop participants and internal stakeholders?
4. Which moments need better guidance, clearer UI, or follow-up work?

## Journey Overview

TRACE currently supports a workshop-ready loop:

1. A visitor discovers TRACE and browses reclaimed materials.
2. A buyer creates an account and explores available materials.
3. A buyer requests seller or hub access when they want to contribute materials.
4. A platform admin reviews and approves access requests.
5. Hub staff register reclaimed materials as digital passports.
6. Hub staff add evidence and list materials in the marketplace.
7. Buyers make offers and track orders.
8. Inspectors submit quality reports.
9. Users submit feedback during testing.
10. Platform admins monitor feedback and activity.

For the workshop, blockchain proof should be treated as a future-ready layer rather than the main demo promise. Some certificates or verification states may appear pending during testing.

## Journey 1: Visitor Discovers TRACE

### User

A public visitor, construction-sector attendee, buyer, or workshop participant.

### Goal

Understand what TRACE is, browse reclaimed materials, and inspect a material passport.

### Journey

1. Visitor lands on TRACE.
2. Visitor learns the product purpose.
3. Visitor browses available materials.
4. Visitor opens a material listing.
5. Visitor reviews the material details, supplier context, condition, and reuse value.
6. Visitor opens or scans the material passport.
7. Visitor checks the passport details and verification status.

### Outcome

The visitor understands what the material is, where it came from, what condition it is in, and why it can be trusted.

### Review Prompts

- Is the first impression clear enough?
- Does the visitor understand why a passport matters?
- Is the verification status understandable if it is still pending?
- What would make this journey feel more trustworthy?

## Journey 2: Buyer Browses and Makes an Offer

### User

A buyer looking for reclaimed construction materials.

### Goal

Create an account, find a suitable material, and make an offer.

### Journey

1. Buyer creates an account or signs in.
2. Buyer browses the marketplace.
3. Buyer searches or filters for a material.
4. Buyer opens a listing.
5. Buyer reviews condition, price, supplier, quantity, and passport information.
6. Buyer adds an optional note.
7. Buyer makes an offer.
8. Buyer sees the offer or order in their transaction area.
9. Buyer can track the order and take follow-up actions.

### Outcome

The buyer has reserved or requested the material and can track what happens next.

### Review Prompts

- Does "make an offer" set the right expectation?
- Should the buyer expect seller approval before an order exists?
- Is it clear that payment is not part of the current flow?
- What information would a buyer need before feeling comfortable making an offer?

## Journey 3: Buyer Requests Seller or Hub Access

### User

A buyer who wants to contribute, manage, or sell reclaimed materials.

### Goal

Request elevated access without being able to self-assign permissions.

### Journey

1. Buyer signs in.
2. Buyer starts an access request.
3. Buyer chooses the type of access they need.
4. Buyer enters organisation or hub details.
5. Buyer adds context for the request.
6. Buyer submits the request.
7. Buyer sees that the request is pending.
8. Buyer waits for platform admin review.

### Outcome

The buyer has a pending request that can be reviewed by the TRACE team.

### Review Prompts

- Is it obvious why access approval is needed?
- What information should we require before approving a hub user?
- Should users be able to edit or withdraw a pending request?
- How should users be notified when a decision is made?

## Journey 4: Platform Admin Reviews Access

### User

TRACE operator or platform admin.

### Goal

Approve the right people into the right organisation and role.

### Journey

1. Platform admin signs in.
2. Admin reviews pending access requests.
3. Admin checks the requested role, organisation, and user-provided context.
4. Admin approves or rejects the request.
5. If approved, the user gains the correct hub access.
6. Admin can later update or revoke access if needed.
7. Admin can review approved users and organisation details.

### Outcome

Trusted users can operate on behalf of the right hub, while access remains controlled.

### Review Prompts

- Is the approval process lightweight enough for workshop use?
- What checks should happen before approval in a real rollout?
- Should hub admins be able to approve their own staff later?
- What audit trail or notes would make approvals easier to govern?

## Journey 5: Hub Staff Registers a Material Passport

### User

Hub staff registering reclaimed material.

### Goal

Create a digital passport with enough information for reuse, inspection, and marketplace listing.

### Journey

1. Hub staff signs in.
2. Staff starts a new material registration.
3. Staff enters material identity and basic description.
4. Staff adds material specifications.
5. Staff adds circularity and environmental information.
6. Staff reviews the information.
7. Staff submits the passport.
8. TRACE creates a material passport and QR code.
9. Staff can view the material in inventory.

### Outcome

The material now has a digital passport that can be inspected, shared, and listed.

### Review Prompts

- Is the registration journey the right length for hub staff?
- Which fields are essential for workshop testing?
- Which fields are essential before production?
- Does the user understand what happens after they submit?

## Journey 6: Hub Staff Adds Evidence and Lists Material

### User

Hub staff preparing a material for marketplace discovery.

### Goal

Add condition evidence and make the material available to buyers.

### Journey

1. Hub staff opens a registered material.
2. Staff adds condition photos or supporting evidence.
3. Staff reviews the passport details.
4. Staff chooses to list the material.
5. Staff sets price, quantity, and fulfilment details.
6. Staff publishes the listing.
7. The material appears in the marketplace.
8. Staff can later cancel or manage the listing.

### Outcome

The material is visible to buyers with enough context to support reuse decisions.

### Review Prompts

- What evidence would make a listing credible?
- Is price, quantity, and fulfilment enough for workshop testing?
- What would sellers expect to manage after publishing?
- Should the listing process require a quality report first?

## Journey 7: Buyer Tracks an Offer or Order

### User

Buyer who has made an offer on reclaimed material.

### Goal

Track the status of the material request and record the outcome.

### Journey

1. Buyer makes an offer from a listing.
2. Buyer sees the offer or order in their account.
3. Buyer tracks status.
4. Buyer confirms delivery once the material is received.
5. Buyer can cancel or raise an issue if something goes wrong.

### Outcome

The buyer has a record of the transaction and can complete or flag the order.

### Review Prompts

- Does this journey feel like an offer, reservation, or order?
- What status labels would make the most sense to buyers?
- What should happen if a seller cannot fulfil the material?
- What buyer actions should be available at each stage?

## Journey 8: Inspector Submits a Quality Report

### User

Inspector, hub admin, or approved quality reviewer.

### Goal

Record a condition assessment against a material passport.

### Journey

1. Inspector signs in.
2. Inspector starts a quality report.
3. Inspector identifies the material passport.
4. Inspector scores condition across key categories.
5. Inspector adds an overall grade and notes.
6. Inspector submits the report.
7. The report becomes visible against the material passport.

### Outcome

The passport has stronger quality evidence for buyers, hub users, and reviewers.

### Review Prompts

- Who should be allowed to submit quality reports?
- What scoring categories are most useful?
- Should evidence photos be mandatory?
- How should disputed or outdated reports be handled?

## Journey 9: Workshop User Submits Feedback

### User

Any authenticated workshop participant.

### Goal

Share product feedback while testing the app.

### Journey

1. User completes a testing task.
2. User opens the feedback form.
3. User selects a rating and category.
4. User writes a short comment.
5. User submits feedback.
6. Admins review feedback after or during the session.

### Outcome

The team receives structured feedback tied to the workshop experience.

### Review Prompts

- Are the feedback categories useful?
- Should feedback be anonymous or tied to user accounts?
- Do we need export, tagging, or triage before the workshop?
- What questions do we most want feedback to answer?

## Journey 10: Platform Admin Monitors Activity

### User

TRACE operator, platform admin, or workshop facilitator.

### Goal

Understand what happened during testing and spot issues quickly.

### Journey

1. Admin signs in.
2. Admin reviews recent activity.
3. Admin checks feedback submissions.
4. Admin looks for failed or confusing moments.
5. Admin follows up on access, marketplace, passport, or quality issues.

### Outcome

The team can monitor workshop progress and identify follow-up work.

### Review Prompts

- What activity should facilitators monitor live?
- What information is useful after the workshop?
- What should be turned into a product backlog item?
- What should be ignored as workshop-only noise?

## Suggested Workshop Flow

1. Start as a public visitor and browse the marketplace.
2. Inspect a material passport.
3. Register a new material as hub staff.
4. Add evidence and list the material.
5. Make an offer as a buyer.
6. Submit a quality report as an inspector.
7. Submit feedback from inside the app.
8. Review feedback and activity as an admin.

## Key Questions for Internal Review

1. Are these the right journeys to test in the workshop?
2. Which journey is most important to get right first?
3. Which journey currently creates the most confusion?
4. What language should change before stakeholders see it?
5. What must be fixed before the June 8 workshop?
6. What can safely wait until after the workshop?

## Known Product Gaps to Discuss

| Gap | Why It Matters |
|---|---|
| No payment or checkout | Buyers cannot complete a real purchase yet |
| Offer flow needs clearer language | Users may confuse offers, reservations, and orders |
| Notifications are not available yet | Users must check the app manually |
| Access approval is admin-led | Hub onboarding depends on platform admin review |
| Quality evidence can be stronger | Reports and photos need clearer expectations |
| Blockchain proof is not the workshop focus | Verification status may need careful explanation |
| Feedback review is lightweight | Team may need manual follow-up after testing |

## Commenting Guidance

When reviewing, please comment directly on:

1. Missing user steps.
2. Confusing language.
3. Incorrect assumptions about real-world workflows.
4. Workshop risks.
5. Must-have changes before sharing externally.

