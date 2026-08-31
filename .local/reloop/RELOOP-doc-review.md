# RELOOP Part B (v0.3) — Review Notes & Technical Q&A

**Reviewed:** 31 August 2026 · **Status:** working draft, submission not yet scheduled here (effort tables due 12 Sept, budget workbook freezes 26 Sept per the doc's own internal notes)
**Source documents:** `RELOOP_PartB_v0.3.docx.md`, `Reloop circularity presentation.pdf` (28 slides, stakeholder review deck, same folder)
**Method:** Read both source documents in full; cross-checked every claimed "existing asset" and architecture choice against the live TRACE codebase (`/dev-github/TRACE`) — schema, contracts, services, middleware — plus one external web check on a fast-moving dependency (Kùzu/LadybugDB). Also draws on the adjacent `.local/be-st_awards_2026/BE-ST-awards-doc-review.md` (27 Aug 2026), which independently audited TRACE's real production state.
**Owner:** Adventurous Systems (technology partner on the bid). IP/legal terms are being handled separately — not covered here.

This file is meant to be a living reference — append to it as answers come in from Dounas/TU/e/RGU/the cities, rather than starting a new file each pass.

---

## 1. The single highest-priority fix

**Beyond-SOTA claim #3 (Part B §1.1) is built on a timeline that doesn't hold.** The doc frames the Waste Shipment Regulation (applies from 21 May 2026) as a change happening "inside our project window" (line 81) — but month-numbering elsewhere assumes a **September 2027 start** (lines 227, 339), and the stakeholder deck states that start date as fact ("September 2027 – August 2031", slide 1). 21 May 2026 is 16 months *before* September 2027. By the time RELOOP starts, the WSR will already be settled law, not a live experiment. The same issue hits the EPBD-transposition framing (line 171: "the live transposition window is itself Rules-thread material") — transpositions are due end-May 2026, also over a year before the assumed start.

**Fix:** reframe both as "the settled regime we operate under," not "a change inside our window" — or confirm the project genuinely starts earlier than Sept 2027, in which case this resolves itself. Either way, don't leave it as-is; it's a headline differentiator that a numerate evaluator will unwind in one glance at the topic ID's expected timeline.

---

## 2. Cross-check: what's actually running vs. what the doc claims

TRACE is real and operating, but "operating commercial platform" and the claimed entry TRLs need to be reconciled against two hard facts already on record:

- **Per the BE-ST audit (27 Aug 2026):** zero on-chain anchors exist in production (`blockchain_transactions`: 0 rows), `MATERIAL_REGISTRY_ADDRESS` is unset, testnet go-live is explicitly blocked per the June audit, and the platform has had **zero new passports/listings/transactions/signups since the 4–8 June workshop** — 11+ weeks dormant as of that review. Only 1 of 61 organisations (Stirling Reuse Hub — also RELOOP's named Glasgow material-bank partner) is a genuine operating hub.
- **This session's grep of the codebase found no trace of:** CryptoTwin, AFlow, a Kùzu/LadyBugDB knowledge graph, or any IFC/W3C-Linked-Building-Data toolchain — all listed in Part B's TRL ledger (lines 93–104) as existing assets co-owned "Adventurous + HWU." The stakeholder deck (p.13) is more careful, calling the graph twin "research" and stating plainly: *"What does not yet exist is: a persistent identity that survives a component moving between buildings... The claim is not that this works end-to-end."*

**Before entry TRLs are "confirmed in writing" (as the doc requires of each component owner):**
- Get a straight answer on where CryptoTwin actually lives and in what state — it needs to be demonstrable if a Horizon auditor asks.
- Find out what "AFlow" is. If nobody on the Adventurous side recognises it as one of ours, someone has attributed an asset to the company's name without sign-off — worth an undiplomatic, direct question to the coordinator.
- Treat "TRL 6–7 → 8" for the passport layer as **not yet defensible** given the dormancy/zero-anchor findings above, until there's a concrete plan (and evidence) to change that.

**Confirmed accurate:** the GDPR/off-chain claim (line 121) checks out — `MaterialRegistry.sol` only stores `dataHash`, `owner`, status, and a metadata URI; no personal data on-chain.

---

## 3. Other internal contradictions in Part B worth reconciling

| Issue | Where | Fix |
|---|---|---|
| "Every headline number... can be traced to signed records" (absolute claim) | line 149 | Contradicted by §2.1's own 5-year impact arithmetic, which is explicitly Eurostat-scaled extrapolation, not measured records (line 280). Scope the claim to K1–K8 only. |
| Beam-7 "capability" language reads as already working | line 79 | Deck's own per-stage TRL breakdown (p.12) rates the end-to-end loop TRL 1–2 "at start" and says it doesn't exist yet. Keep Part B's Beam-7 prose consistent with the hedge already present at line 105. |
| Gender-dimension page "due with the M9 consortium meeting" | line 249 | If "M9" means month 9 of the *funded* project, that's after submission — gender/SSH content is normally scored at evaluation, not filled in later. Confirm which is meant. |
| Glasgow's "5–10% reused" baseline | line 45 | Deck (p.3) presents the same 5–10% figure as an EU-wide statistic, not Glasgow-specific. Trace to its actual source (SEPA?) before it's locked in as a documented city baseline. |
| Marketplace enters at TRL 4 while TRACE overall is called TRL 6–7 | lines 95, 101 | Internally acknowledged (line 105) but still needs a real, written justification from whoever owns the marketplace module. |

---

## 4. Consortium & governance flags (non-legal)

- 3 of 15 participants (the beneficiary cities — structurally required for eligibility, line 37) are still "in engagement"; 2 SME slots open; 2 housing associations "tbc"; 1 legal entity unconfirmed. Deck (p.15, same date as the draft) independently confirms "six organisations engaged, none yet confirmed." Effort tables due 12 Sept, budget freezes 26 Sept — ask the coordinator for the actual drop-dead date and the fallback if any of the three cities doesn't confirm (this is not a mitigable risk under the topic's own eligibility rules).
- AG Vespa as Antwerp's legal entity (line 27) — worth checking whether an arm's-length municipal development company satisfies the topic's "cities as beneficiaries" condition as literally worded.
- Zero Waste Scotland's beneficiary-vs-associated status is unresolved (line 31) despite originating the entire Glasgow flagship.
- Confirmed this session: Dr Theodoros Dounas (HWU) is part of Adventurous Systems as well as HWU's PI/coordinator — consistent with the COI structure the doc describes (independent Co-PI, independent WP8 oversight, HWU Research Integrity Office declaration). IP/legal review of this is being handled separately, not here.

---

## 5. Software/architecture questions — status as of this session

Answers given by Adventurous Systems this session, with follow-on implications:

1. **TRACE stays one shared platform; federation happens above it (graph/semantic/AI layers), not at the platform level.** → Part B's "federated, not centralised... no company sits in the middle" line (114) should be reworded to match this, or it overclaims decentralisation of the platform itself.
2. **Adventurous's exact role still forming** as the document evolves — no action yet.
3. **Multi-hop custody (owner → material bank → buyer) is new WP5 work**, not a hardening of what exists (confirmed: `listings`/`transactions` today are single buyer↔seller only, no custodian role). **Recommendation:** build it as new event types on the existing `passportEvents` table (already EPCIS 2.0-shaped) rather than a parallel custody table — one ledger of "what happened to this thing," not two that can drift apart.
4. **Per-user self-controlled signing is planned**, with an ENS-style naming layer and possibly ZK-proofs for privacy-preserving credential checks. Checked against the `vechain-core` skill + web search:
   - **Naming: already exists.** [VET Domains](https://vet.domains/) — `.vet` names, public lookup API, `useVechainDomain` hook via VeChain Kit. No need to build this.
   - **Self-custody without raw-key risk: already exists.** VeChain's official [Smart Accounts](https://github.com/vechain/smart-accounts) (`SimpleAccount`/`SimpleAccountFactory`) + VeChain Kit's social-login-backed smart wallets (Privy) solve exactly the "inspector shouldn't hold a seed phrase" problem. Build on these rather than inventing account infrastructure.
   - **ZK/selective disclosure: nothing exists in the VeChain ecosystem** (checked skill + search — no hits). This is genuine R&D. Recommended path: W3C Verifiable Credentials + DIDs first (standards-based, dovetails with TU/e's RDF work — define a `did:vechain:` method), ZK-based selective disclosure as a Phase 2/3 stretch goal, not a Phase 1 dependency.
5. **City/regulator/insurer dashboards are new product surfaces, costed as such if that's the right call.** RBAC mechanism (`authorize(...roles)` in `middleware/auth.ts`) is clean and extends easily to new roles. **Gap:** no "region/city" grouping over organisations exists yet — a permitting officer's dashboard needs an aggregate view across many hubs *within their city only*, and there's currently no schema concept for that. Solve once, centrally, before WP6 dashboard work starts (same root cause as item in §6 below).
6. **Adventurous will build the cross-border clearance-order state machine with the relevant stakeholders.** Recommendation: audit-log-first against `auditEvents`/`passportEvents`, with explicit tests asserting the *wrong* order is rejected — auditors will want proof of prevention, not a happy-path demo.
7. **Graph database: Kùzu is dead, LadybugDB is its revival fork — verify this is an acceptable risk before committing.** Confirmed via web search: Kùzu Inc. was quietly acquired by Apple (announced Oct 2025; motive surfaced via an EU DMA filing Feb 2026) and the project was archived. LadybugDB is a community fork of the *same codebase* (same property graph model, same Cypher, MIT license) started in 2025 — not a different technology. A second fork ("bighorn," Kineviz) also exists, so the community has already split. Sources: [The Register](https://www.theregister.com/software/2025/10/14/kuzudb-graph-database-abandoned-community-mulls-options/1142229), [BigGo](https://biggo.com/news/202510130126_KuzuDB-embedded-graph-database-archived), [LadybugDB/ladybug](https://github.com/LadybugDB/ladybug).
   Given RELOOP's own 10-year post-project stewardship commitment, this deserves a short bake-off rather than defaulting to whatever HWU's research already used:
   - **Neo4j (Community)** — most mature; has an actual RDF bridge (neosemantics), which is directly relevant to RELOOP's hardest problem (bridging property-graph and RDF/LBD representations) — potentially collapses two databases + a coordination protocol into one database with two views.
   - **Memgraph** — Cypher-compatible, in-memory, backed by an actual company.
   - **Apache AGE** (Postgres extension) — Cypher-style queries inside Postgres itself, removing the second-database/dual-write consistency problem entirely, since Postgres is already the system of record. Less proven at large graph-traversal scale.
   - **A dedicated RDF triple store** (Jena/Fuseki, GraphDB) for the semantic layer specifically, property graph staying lightweight/Postgres-based — matches the deck's own "dual-representation architecture" (p.9) more literally.
8. **Spec co-authored by Dounas, Adventurous, and TU/e.** Make sure it ships as a versioned, standalone document (not "read the TypeScript types") — it's what the V3 round-trip conformance suite has to test against independently.
9. **Simulated anchoring will retire once funded; near-term need is a repeatable, low-maintenance demo environment.** Recommendation: extract `env.DEMO_SIMULATE_ANCHOR` (currently inline at two call sites in `passport.service.ts`, about to multiply since `qualityReports` and `passportEvents` each carry their own `blockchainTxHash`) behind a single `AnchorProvider` interface (`RealAnchorProvider` / `SimulatedAnchorProvider`), chosen once at composition — turns "retire in prod, keep for demos" into a config choice. For the evergreen-demo problem specifically: extend the existing `reset:marketplace`/`sync:users` script pattern into an idempotent demo-dataset seed/reset script.
10. **ERC-998 needs replacing — resolving now to avoid technical debt, correctly.** No evidence anyone's deployed ERC-6551 (the modern token-bound-account standard) on VeChainThor — either path is new ground. **Prior question worth asking first:** does RELOOP need on-chain composability (cascading ownership when an assembly moves) at all, or is "this beam is now part of this wall" better modelled as a passport-to-passport graph relationship with only the top-level hash anchored on-chain — consistent with `MaterialRegistry.sol`'s existing minimal-footprint design? Leaning toward: don't adopt a composable-NFT standard unless there's a specific transactional reason for atomic on-chain movement.

---

## 6. Additional technical-debt flags (architecture robustness)

- **Passport-hash has no schema version.** `passport-hash.ts`'s `buildCanonicalJsonLd` is well-built (deterministic, sorted keys, shared between real and demo paths) but hardcodes today's field list. The first RELOOP field addition (biogenic carbon, condition-over-time, an LBD-mapped attribute) means a re-hash of an old passport under the new function won't match its original on-chain hash. **Fix now:** embed an explicit `schemaVersion` in the canonical doc and branch the hash function by version.
- **No region/city entity in the schema.** Same root cause behind item 5 above and the city-dashboard aggregation problem — a first-class grouping over `organisations` is needed before any city-scoped dashboard is safe to ship, or the first city becomes a one-off hack the next two have to copy.
- **JSONB fields have no contract once outside institutions write to them.** `technicalSpecs`, `customAttributes`, `hazardousSubstances`, `materialComposition` are all open `Record<string, unknown>`. Fine while only Adventurous writes them; once RGU's biogenic-carbon module or a Cycle-3 grower's system writes into these, nothing guarantees a shared shape. Zod-validate and version the contents of any field a RELOOP partner will write to, before that dependency exists.
- **OLTP and analytics sharing one database.** Whole-life-carbon inventories, DEA benchmarking, and city-twin AI queries are heavy analytical workloads. Running them against the same Postgres instance serving live marketplace checkout risks a slow dashboard query locking up a real transaction. Plan a read-replica or reporting layer before WP6/WP8 analytics land in production.
- **`transactions` has no `currency` column** (only `listings` does) — a transaction should carry its own currency rather than inherit it implicitly, given real cross-border EUR/GBP transactions are the whole point of the corridor.
- **Scope-sizing risk, independent of IP/legal:** this Q&A alone surfaced several genuinely new subsystems (multi-hop custody, region-scoped RBAC, account-abstraction-based signing, new stakeholder dashboards, a compliance-critical state machine, cross-institution JSONB governance) beyond "harden the existing marketplace." Make sure the WP4/WP5 effort tables due 12 Sept reflect this real scope rather than the lighter "hardening" framing currently in the TRL ledger — an underestimate here recreates the exact time-pressure conditions that produce technical debt.

---

## 7. Open questions to send to the coordinator / partners

1. What's the real submission deadline, and does it still support a Sept 2027 start? If so, fix the WSR/EPBD "inside our window" framing now.
2. What exactly is AFlow, and what's the evidence trail for CryptoTwin's claimed TRL 4?
3. What's in the pre-award risk register for the three cities, and what's the actual contingency if one doesn't confirm beneficiary status in time?
4. Is the gender-dimension page due before submission, or genuinely deferred to project M9?
5. Has Kùzu/LadybugDB actually been evaluated for multi-city concurrent production use, or only for a single research analysis job? What's the fallback if LadybugDB doesn't stabilise?
6. Who is formally responsible for the passport schema spec artifact TU/e's conformance suite will test against — is it versioned and published somewhere both teams can point to?

---

## 8. Not covered here

IP ownership, background/foreground split, FRAND access terms for TRACE's proprietary modules, and the coordinator/PI conflict-of-interest governance — all explicitly deferred to a separate legal review per the team's own steer.
