# Recoup — Remediation Plan (Response to Mentor Review)

**Status:** borderline shortlist → target: unambiguous advance
**Core problem in one line:** the engine is a well-engineered, honestly-disclosed *deterministic simulator harness* whose headline ₹ is produced by the simulator, not by the agent — and there is no AI in an AI buildathon.

There are exactly **two must-fix** items. Everything else is credibility polish.

| # | Gap | Severity | Blocks advancement? |
|---|---|---|---|
| G1 | No LLM/AI anywhere — deterministic rules engine | **Critical** | Yes (track requirement) |
| G2 | Playbook ablation moves net incremental by +₹3,703 (0.0003%) → decisions are causally inert | **Critical** | Yes (headline is unearned) |
| G3 | Audit chain covers 576 events (560 = `MID_LADDER_CANCELLED`); 2,611 gate decisions, 1,252 comms, 709 recoveries sit in mutable tables | High | Contradicts R4 claim |
| G4 | PTP path fires for *any* Surface D item regardless of playbook; 55% capture drives 94% of value | High | Root cause of G2 |
| G5 | `measure.ts` holdout scaling on 41 Surface-D holdout rows → CI ±₹2.8 Cr | High | Undermines R1 |
| G6 | 11 tests, 2 order-dependent, README instructions yield 11/11 failures | Medium | Reproducibility claim false |
| G7 | Compliance gate non-bypassability asserted, not proven | Medium | R2 evidence gap |

---

## Phase 0 — Stop the bleeding (2–3 hours)

Cheap, high-trust-per-minute fixes. Do these first even if nothing else ships.

1. **Fix the README repro path.** Make `bun test` pass from a clean clone. Add `test/setup.ts` that seeds an isolated in-memory/temp DB per suite; remove the implicit dependency on pipeline ordering. Acceptance: `git clone && bun install && bun test` → 100% pass on a cold machine, verified in a throwaway container.
2. **Add CI.** GitHub Actions running clone → install → test → full pipeline → assert headline numbers within tolerance. A green badge answers G6 permanently.
3. **Correct the R4 wording now.** Replace "every state change and gate decision produces an event" with the honest version: *"576 lifecycle events are hash-chained; gate decisions, comms, and recoveries are logged to separate mutable tables (coverage gap, see roadmap)."* Fixing the claim before a judge finds it converts a credibility hit into a credibility win.
4. **Publish the ablation yourself.** Add `docs/ABLATION.md` with the identical-playbook result (+₹3,703, lift unchanged at 1474%) *stated by you*. Self-disclosed negative results read as rigour; discovered ones read as concealment.

---

## Phase 1 — Make the agent causally matter (G2 + G4) — 1–1.5 days

This is the heart of it. Right now `resolve_outcome()` for Surface D fires the PTP branch on surface identity, so playbook selection is a no-op on the segment generating 94% of value.

**1.1 Rewrite outcome resolution so playbook is an input, not decoration.**
Replace surface-keyed branching with a per-case response function:

```
P(recover | case, action) = base(root_cause, days_late, amount_band)
                          × channel_fit(action.channel, debtor.persona)
                          × message_fit(action.playbook, root_cause)   ← currently absent
                          × fatigue(prior_touches)
                          × timing(hour, ladder_stage)
```

`message_fit` must be a real matrix: PROMISE_TO_PAY on an *approval-queue* root cause should underperform ESCALATE_TO_AP_OWNER; PO/GRN mismatch should be near-zero for any dunning playbook and high for DOCUMENT_REPAIR. Mismatched playbooks should also *burn* future capture (fatigue penalty), so wrong choices cost money.

**1.2 Fix PTP recovery accounting.** Trace and document: does a promise recover 100% of face value? It should not. Model `P(honoured)` (~60–70%), partial payment fraction, and slippage days — with time-value discounting so an accelerated collection ≠ a new collection. This alone will move the headline down, which is correct and defensible.

**1.3 Re-run the ablation as the acceptance test.** Target: identical-playbook ablation degrades net incremental by **≥25%**. Add a random-playbook arm and an oracle-playbook arm to bracket the agent. Commit `bun run ablate` as a first-class pipeline stage.

**1.4 Expect and own the headline drop.** 1474% lift will fall, likely a lot. Lead with the new number *plus* the ablation delta. "+X% lift, of which Y percentage points are attributable to agent decisions (ablation-verified)" is a far stronger claim than an unattributable 1474%.

---

## Phase 2 — Put AI in the loop, meaningfully (G1) — 1 day

Not a chatbot bolted on the side. Two integration points where an LLM does work rules cannot, both **gated and audited exactly like every other action**.

**2.1 LLM root-cause diagnosis (Surface D).** Feed the model the unstructured evidence — remittance advice text, AP email threads, invoice line items, gateway decline narratives — and have it emit structured JSON: `{root_cause, confidence, evidence_spans[], recommended_playbook, rationale}`. This is a genuine NLU task; today it's keyword matching.
- **Benchmark it.** Hold out labelled cases; report LLM vs. rules-engine diagnosis accuracy and the downstream ₹ difference. That table *is* your "meaningful use of AI" answer.
- **Failure path:** low confidence or schema-invalid output → deterministic rules fallback, logged.

**2.2 LLM message composition under constraints.** Generate the Hinglish/English touch copy per debtor persona and ladder stage — then run it through a **deterministic validator** (TRAI DLT template match, banned-phrase list, tone-ladder stage, no-threat check). Non-conforming output is rejected and regenerated, max N attempts, then falls back to the static template. Every generation, rejection, and fallback is a chained audit event.

**2.3 The safety story is the differentiator.** "LLM proposes, deterministic compliance gate disposes, hash chain records both" is a stronger buildathon narrative than either component alone. Make that the demo's centrepiece: show a generated message being *blocked*.

**2.4 Determinism preserved.** Cache LLM responses keyed by prompt hash and commit the cache, so seed-42 reproduction stays exact and offline. Judges reproduce without API keys.

---

## Phase 3 — Make the audit claim true (G3 + G7) — half day

**3.1 One ledger, one chain.** Route `gate_decisions`, `comms`, `recoveries`, `diagnoses`, and state transitions through the same `audit.append()`. Expected volume ≈ 5,100+ chained events vs. 576 today. Keep the specialised tables as *projections* built from the ledger, not as parallel sources of truth.

**3.2 Enforce append-only for real.** SQLite `BEFORE UPDATE`/`BEFORE DELETE` triggers raising on every ledger table; verify with a `test/tamper.test.ts` that attempts an update, a delete, and a mid-chain rewrite, and asserts detection at the right sequence number.

**3.3 Prove the gate is non-bypassable.** Assertion is not proof. Do at least two of:
- Route all adapter dispatch through a single choke point that requires a `GatePassport` token minted only by `gate()` (unforgeable by type + runtime nonce).
- A lint/AST test that fails CI if any adapter is imported anywhere outside `execute.ts`.
- Negative tests: attempt a direct adapter call, a quiet-hours send at 21:30 IST, a DND send, a send during an outage — all must throw.
Publish this as `docs/GATE_INVARIANTS.md` with the tests named.

**3.4 Quiet-hours hardening.** Test DST-free IST edge cases, boundary minutes (07:59:59 / 19:00:00), scheduled-vs-executed time divergence, and cross-midnight retries.

---

## Phase 4 — Honest measurement (G5) — half day

**4.1 Report per-stratum n alongside every estimate.** Surface D's 41 holdout rows must appear next to the ₹ figure, always.

**4.2 Stabilise small strata.** Collapse the 36 strata to those with n ≥ 30 per arm, or apply empirical-Bayes shrinkage toward the pooled mean. Report both raw and shrunk estimates.

**4.3 Switch to stratified bootstrap** (resample within stratum, preserving arm sizes) and add a permutation test for a p-value that doesn't depend on the scaling assumption.

**4.4 Sensitivity band.** Show how net incremental moves as the Surface-D holdout scale factor varies ±1 SE. If the headline is fragile to 41 rows, say so in a chart — that framing survives scrutiny; a point estimate does not.

**4.5 Optional, high value:** raise the holdout to 25% for Surface D only (variance-optimal allocation) and re-run. Costs simulated recovery, buys a defensible CI.

---

## Phase 5 — Re-pitch (2–3 hours)

Rewrite the README top section around what is now *earned*:

1. **Attributable lift** — headline ₹, ablation-verified agent contribution, CI with n disclosed.
2. **AI where it matters** — LLM diagnosis accuracy vs. rules baseline, ₹ delta, and the constrained-generation safety loop.
3. **Provably safe autonomy** — 5,100+ chained events, non-bypassable gate with named invariant tests, live tamper demo.
4. **Reproducible** — green CI badge, cold-clone instructions that actually work.

Add `docs/MENTOR_REVIEW_RESPONSE.md` mapping each mentor point → what changed → where to verify. Walking in with your critic's list already closed is the single strongest move available.

---

## Sequencing & effort

| Order | Phase | Effort | Why this order |
|---|---|---|---|
| 1 | Phase 0 | 2–3 h | Unblocks judges; cheap credibility |
| 2 | Phase 1 | 1–1.5 d | Everything else is decoration if decisions stay inert |
| 3 | Phase 2 | 1 d | Hard track requirement; depends on Phase 1's playbook semantics |
| 4 | Phase 3 | 0.5 d | Independent, parallelisable |
| 5 | Phase 4 | 0.5 d | Must run after Phase 1 changes outcomes |
| 6 | Phase 5 | 2–3 h | Last — numbers must be final |

**Total ≈ 4 working days.** If time is shorter, the minimum viable set is **Phase 0 + Phase 2.1 + Phase 3.1 + the honest re-framing in Phase 5** — that clears the AI bar and the false-claim risk, leaving G2 disclosed rather than fixed.

## Definition of done

- [ ] Cold clone → `bun test` green in CI
- [ ] Identical-playbook ablation degrades net incremental ≥25%
- [ ] LLM diagnosis benchmarked against rules baseline, with ₹ impact
- [ ] ≥5,000 hash-chained audit events; mutable side tables eliminated or demoted to projections
- [ ] Gate non-bypassability backed by passing negative tests, not prose
- [ ] Every ₹ figure published with its stratum n and a sensitivity band
- [ ] `MENTOR_REVIEW_RESPONSE.md` closing all seven gaps

---

## Two risks worth naming

**The headline number will shrink.** That is the point. A defensible ₹4 Cr with an ablation-proven agent contribution beats an indefensible ₹11.3 Cr that a judge dismantles in three questions.

**LLM integration can break determinism.** The prompt-hash response cache is non-negotiable — commit it, and keep the rules-engine fallback path always live so the pipeline runs with zero API keys.
