# TRACE Workshop Demo — 8 June 2026

Run sheet for the live demo. The full seller-to-buyer loop is pre-loaded and working. **Estimated total: ~45 min.**

---

## Quick reference

| | |
|---|---|
| **Production** | https://trace.adventurous.systems |
| **Fallback** | https://trace-staging.adventurous.systems |

### Workshop accounts (all role: supplier · password: `TRACE_SRH!`)

| Email | Name |
|---|---|
| `ada.lovelace@example.com` | Ada Lovelace |
| `hicomcd@gmail.com` | Hico |
| `m.victoria@rgu.ac.uk` | Michele Victoria |
| `t.dounas@hw.ac.uk` | Theodoros Dounas |
| `zj20@hw.ac.uk` | ZJ |

### System accounts (facilitator use only)

| Email | Password | Role |
|---|---|---|
| `platform@trace.eco` | `Platform1234!` | Platform admin (access requests, feedback) |
| `admin@stirlingreuse.com` | `Admin1234!` | Hub admin (Stirling Reuse Hub) |
| `inspector@trace.eco` | `Inspector1234!` | Inspector (quality reports) |

---

## Morning-of checklist

- [ ] https://trace.adventurous.systems loads; log in as any workshop account succeeds
- [ ] Marketplace shows **7 products** with photos
- [ ] Open any passport → click **Verify integrity** → shows "Untampered"
- [ ] Fallback URL loads (same logins, same data)
- [ ] Screen visible on projector at readable zoom
- [ ] Have this doc open on a second device

---

## Part 1 — Live demo (≈10 min, presenter only)

Walk the story end-to-end while narrating. Use your own account (`hicomcd@gmail.com`).

### 1. The marketplace (no login needed)

Go to `/marketplace`. 

> *"Any buyer can browse reclaimed materials, no account needed. Each card shows carbon savings and a certified grade."*

Open a listing — e.g. **K-BRIQ® Medero Dark Grey**.

> *"This is a material passport — a digital record of exactly what this product is, where it came from, and why it can be trusted."*

### 2. The trust certificate

Scroll to the **Trust certificate** panel. It shows **"Trust layer prepared"** with a green seal.

Click **Verify integrity.**

> *"The platform just recomputed a cryptographic fingerprint of this passport's data and confirmed it matches the stored record. If anyone edited the data, this would say Mismatch. The blockchain anchoring step connects this fingerprint to VeChainThor — that's the next phase after the pilot."*

### 3. Register a new material (log in first)

Log in as `hicomcd@gmail.com`. Go to **Passports → New passport**.

Fill in a quick material (e.g. "Reclaimed Timber Beam", category Timber, grade B, give it a weight and description). Upload a photo. Submit.

> *"Hub staff register materials through this wizard. The QR code is generated instantly — print it, attach it to the item, and anyone can scan it to see this exact record."*

Show the QR on the created passport. Scan it with a phone, or click the public link — it opens without login.

### 4. List it on the marketplace

On the passport detail, click **Create listing**. Set a price (e.g. £5) and a note.

Go to `/marketplace` — the listing appears immediately.

### 5. A buyer makes an offer

Open an incognito window (or use a second device). Go to the marketplace without logging in. Open the listing, click **Make an offer**, log in as `ada.lovelace@example.com`, complete the offer.

> *"The buyer doesn't need a blockchain wallet. They submit an enquiry through the platform — the seller gets notified and manages the order through their dashboard."*

---

## Part 2 — Group hands-on (≈25 min)

Give each attendee their credentials. Each person walks the flow independently:

1. Log in → go to **Passports → New passport**
2. Register a material from their area of expertise
3. Upload a photo (phone camera works)
4. View the public passport (scan the QR)
5. Create a listing with a price
6. Another attendee (or facilitator) makes an offer

**Facilitator tips:**
- If someone gets a 403, they may be on the wrong page (quality reports need `inspector@trace.eco`; access-request approval needs `platform@trace.eco`)
- If a photo upload stalls, try a smaller JPEG (<3 MB)
- The trust certificate shows "pending" for a few seconds while the fingerprint is computed — normal

---

## Part 3 — Governance & feedback (≈10 min)

### Access management

Log in as `platform@trace.eco`. Go to `/admin/access-requests`.

> *"When a new organisation wants to join TRACE, they submit a request here. The platform admin reviews their credentials and approves or rejects. This is how the commons governance works — every hub is vetted before they can issue certified passports."*

### Live feedback

Ask attendees to click the **Feedback** button (bottom-right of any dashboard page): give it a rating and a comment.

Log in as `platform@trace.eco`, go to `/admin/feedback` — show their submissions appearing in real time.

---

## If something breaks

| Problem | Fix |
|---|---|
| Prod unavailable | Switch to https://trace-staging.adventurous.systems — same logins |
| Wrong role error (403) | Check the role table above — some actions need specific system accounts |
| Photo doesn't load | Refresh the page; MinIO serves from `/minio/passports/…` — check the network tab |
| Trust certificate stuck on "pending" | Refresh; the fingerprint worker runs in the background (usually <5 s) |
| Login fails | Confirm password is exactly `TRACE_SRH!` (capital T, exclamation mark) |

---

## After the session

- [ ] Platform admin reviews all feedback at `/admin/feedback`
- [ ] Export any useful passport data before resetting
- [ ] Run `pnpm --filter @trace/db reset:marketplace --yes` to wipe test passports created during the session (keeps the 7 curated products)
- [ ] Rotate or disable workshop accounts after the pilot
