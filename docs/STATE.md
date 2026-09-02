# Recoup — build state

Single source of truth for progress. Read this first on every session. Do not rely on conversation memory.

**Project:** Recoup (Track 03 · AI Revenue Recovery)
**Plan:** `PROJECT_PLAN.md` v1.0
**Stack:** Bun + TypeScript, SQLite, plain TS engines
**Money:** integer paise only. Currency INR.

---

## Protocol

1. Read this file.
2. Execute the next unchecked step, in order.
3. Before marking a step done, quote that step's Acceptance line from the plan and show how the artefacts satisfy it.
4. Update this file before stopping.
5. After each step, report and wait for "continue" unless told to run ahead.

---

## Steps

| Step | Name | Status | Artefacts |
|------|------|--------|-----------|
| 1 | Domain model + simulated economy | `done` | `db/schema.sql`, `scripts/seed.ts`, `data/recovery.db`, `docs/DATA_DICTIONARY.md`, `out/seed_report.md` |
| 2 | Detection engine | `done` | `engines/detect.ts`, populated `risk_items`, `incidents`, `out/detection_report.md` |
| 3 | Diagnosis engine | `done` | `engines/diagnose.ts`, populated `diagnoses`, `out/diagnoses_report.md` |
| 4 | Policy / playbook engine | `done` | `engines/policy.ts`, `playbooks/*.ts`, populated `intervention_plans`, `plan_steps`, `out/policy_rationale.md` |
| 5 | Guardrails & compliance layer | `done` | `engines/gate.ts`, `gate_decisions`, `docs/COMPLIANCE.md`, `out/suppression_report.md`, `test/gate.test.ts` |
| 6 | Bounded execution runner | `done` | `engines/execute.ts`, `adapters/*`, populated `communications`, `recoveries`, `promises_to_pay`, `out/execution_report.md` |
| 7 | Audit trail | `done` | `engines/audit.ts`, `verify_chain()` CLI, `out/audit_verification_report.md`, `out/audit_case_*.md` |
| 8 | Measurement harness | `done` | `engines/measure.ts`, `out/measurement_report.md`, `out/benchmark_eval.json` |
| 9 | Demo surface | `done` | `server/index.ts`, `web/index.html`, `web/styles.css`, `web/app.js`, `docs/DEMO_GUIDE.md` |
| 10 | Pitch package | `done` | `README.md`, `docs/PITCH_SCRIPT.md`, `docs/HONESTY.md` |

---

## Current

- **Active step:** COMPLETED (All 10 Steps Complete & Verified)
- **Next unchecked:** None — Ready for submission & live demo
- **Last updated:** 2026-08-27 (numbers reflect final corrected outcome resolver — see out/measurement_report.md)

## Notes / assumptions (running)

- **Step 1:**
  - Standard decline taxonomy with 6 major categories (NSF ~35%, Expired ~15%, Issuer Soft ~20%, Technical ~15%, Mandate ~10%, Hard Fraud ~5% ex-outage).
  - All amounts in integer paise (INR).
  - Seeded 1,200 customers, 1,314 risk-bearing events totaling ₹18,64,72,663.00 across 4 surfaces.
  - Injected systemic incident: Razorpay × HDFC degradation (2026-08-19 10:00 to 16:00, 6 hours).
  - Ground truth tables (`ground_truth`, `ground_truth_events`) populated and protected from engine access.

- **Step 2:**
  - `engines/detect.ts` extracts signals across all 4 surfaces: Surface A (471), Surface B (380), Surface C (186), Surface D (277) = 1,314 risk items. Total exposure ₹18,64,72,663.00.
  - Anomaly detector identified the Razorpay × HDFC outage (`inc_000001`, z = -7.14, 88 failures / 120 attempts) and tagged all 21 open at-risk items for suppression.
  - Stratified cohort assignment: exactly 85.0% Treatment (1,117 items, ₹16,20,97,869.00) and 15.0% Holdout (197 items, ₹2,43,74,794.00), stratified across 36 strata (segment × surface × exposure band).
  - Full audit logging: `DETECTION_STARTED`, `INCIDENT_DETECTED`, `RISK_ITEMS_POPULATED`.
  - Zero access to `ground_truth` / `ground_truth_events`.

- **Step 3:**
  - `engines/diagnose.ts` implements hybrid deterministic + keyword-classifier root-cause diagnosis.
  - Covers all 1,314 risk items across surfaces A, B, C, D with structured confidence and multi-item evidence chains.
  - Surface D B2B email threads and dispute notes classified via regex keyword patterns (deterministic, no LLM API call) — field `llm_used=true` marks where a production LLM call would go. Model version tag: `recoup-keyword-classifier-v1`.
  - Full audit logging: `DIAGNOSIS_STARTED`, `DIAGNOSIS_COMPLETED`.

- **Step 4:**
  - `engines/policy.ts` and 11 modular playbooks (`playbooks/*.ts`) evaluate expected value in integer paise.
  - 100% of plans (1,314/1,314) carry written EV rationales with recovery probability, channel cost, goodwill cost, and net value.
  - 1,281 active intervention plans scheduled with 2,578 multi-channel steps and explicit exit criteria.
  - Total expected net recovery value: ₹15,33,37,914.85.
  - 33 items suppressed upfront (21 systemic outage incidents + 12 fraud/bankruptcy flags).
  - Negative-EV items provably skipped with cost-avoidance logging.
  - Full audit logging: `POLICY_STARTED`, `PLANS_COMMITTED`.

- **Step 5:**
  - `engines/gate.ts` implements the single non-bypassable `gate()` function.
  - Evaluated 2,611 actions: 1,929 allowed (73.9%), 682 blocked/suppressed (26.1%).
  - Zero sends outside quiet hours (29 blocked), zero sends to opted-out/DND (129 blocked), zero sends during systemic outage (21 blocked).
  - All 9 stopping rules tested and verified with automated test suite in `test/gate.test.ts` (11/11 tests pass).
  - Deliverables: `engines/gate.ts`, `gate_decisions` table, `docs/COMPLIANCE.md`, `out/suppression_report.md`.

- **Step 6:**
  - `engines/execute.ts` and `adapters/*` run full batch end-to-end with mock dispatchers gated by cryptographic `GatePassport` tokens.
  - Outcome resolver implements formal **Causal Response Function** matching playbooks to true root causes via matrix routing and spam fatigue decay.
  - Treatment recovered **₹4,98,97,852.00** across **434 cases** vs Holdout organic recovery ₹13,46,094.00 across 65 cases.
  - **339 pending steps cancelled mid-ladder** immediately upon payment recovery.
  - Attempt budget strictly capped at maximum 4 contacts per case with **0 violations**.

- **Step 7:**
  - `engines/audit.ts` implements append-only cryptographic SHA-256 hash-chain verification (`verify_chain()`) across **8,308 events**.
  - Database triggers strictly block UPDATE or DELETE operations on `audit_events`.
  - Tested live tampering proof: Mutating a single byte in any audit row triggers immediate hash mismatch and flags exact corrupted sequence number.
  - CLI command: `bun run verify`.

- **Step 8:**
  - `engines/measure.ts` computes exact stratum-weighted incremental recovery over the randomized 15% holdout with empirical shrinkage.
  - Measured **₹2,38,17,692.70** net incremental ₹ recovered (**+317.0% lift** vs organic baseline).
  - 1,000-sample bootstrap 95% confidence interval: **[₹87,90,260.89, ₹4,12,02,537.86]** with non-zero lower bound.
  - Sensitivity band across $\pm 1 \text{ SE}$ of holdout scaling: **[₹2.12 Cr – ₹2.65 Cr]**.
  - First-class Playbook Ablation suite (`engines/ablate.ts`) proves a **-172.0% degradation** when agent intelligence is replaced with naive dunning.
  - Output files: `out/measurement_report.md`, `out/benchmark_eval.json`, `out/ablation_report.md`.

- **Step 9:**
  - Built high-speed executive Single-Page Dashboard in `web/` with dark mode, glassmorphism, responsive telemetry cards, and interactive modal drilldowns.
  - Backed by zero-dependency Bun server `server/index.ts` (`bun run demo` on port 80).
  - Dashboard reads headline metrics live from `runMeasurement()` — numbers always reflect current DB state.
  - Authored `docs/DEMO_GUIDE.md` and `docs/MENTOR_REVIEW_RESPONSE.md`.

- **Step 10:**
  - Master `README.md`, `docs/PITCH_SCRIPT.md`, `docs/GATE_INVARIANTS.md`, `docs/ABLATION.md`, and `docs/HONESTY.md` all synchronized.
  - Full automated CI test suite passing 20/20 tests in cold isolation.

## Blockers

None. All 7 mentor review gaps (G1–G7) and all 10 architectural steps are complete, tested, and verified.
