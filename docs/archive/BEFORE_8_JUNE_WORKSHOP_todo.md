⚠️ Before 8 June — do these

Seed an opening marketplace (highest priority). The marketplace currently has 0 active listings (the only listing, "Test" £99, is reserved/disputed). The demo opens with a logged-out marketplace view — it'd be empty. Seed 2–3 active listings with photos so the opening looks populated. (I can do this.)

Seed the real attendee list. Replace packages/db/data/workshop-attendees.csv with the actual emails and run seed:workshop on prod. Currently only the 3 example suppliers exist.

Clean the leftover "Test" data — the reserved/disputed "Test" passport+listing+transaction under the Ada account (manual test from today). Tidies the demo accounts. (I won't delete it without your OK since you/a colleague created it.)

Known limitations (non-blocking)
9 color-contrast a11y findings remain (faint gray text) — cosmetic; the select-name/link issues are fixed.
CI workflows (e2e.yml, smoke.yml) are written and validated locally but haven't run through GitHub Actions yet — they fire on the next PR / Actions-driven deploy. Not needed for the demo itself.
Meilisearch container unhealthy — marketplace search is SQL-based so it's unaffected; only impacts any Meili-backed indexing.
Shared generic password — fine for the demo; rotate/disable accounts after.