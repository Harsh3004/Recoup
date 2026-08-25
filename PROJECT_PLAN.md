# AI Revenue Recovery — Master Project Plan
**Track 03 · Find revenue that's slipping away and win it back**

_Owner: HARSH JOSHI · Planner: Tasklet · Version 1.0 · 24 Aug 2026_

---

## 1. Product thesis

> A closed-loop agent that watches every rupee in flight — failed payments, dropped checkouts, broken mandates, overdue invoices — **diagnoses why** it stalled, **picks the cheapest intervention that will actually work**, executes it inside hard compliance rails, and **proves the incremental money it brought back** against a randomized holdout.

**Name suggestion:** `Recoup` — "the collections desk that never sleeps, never harasses, and always shows its working."

### What the judges are actually scoring
The brief says it outright: *"Don't just identify the problem. Show measured money recovered across a batch, with compliant escalation, stopping rules, and an audit trail."*

That maps to four hard requirements. Treat these as the acceptance criteria for the whole project:

| # | Requirement | How we satisfy it | Where |
|---|---|---|---|
| R1 | **Measured money recovered across a batch** | Randomized holdout → incremental ₹ lift, not gross ₹ | Step 8 |
| R2 | **Compliant escalation** | Consent/DND, quiet hours, TRAI DLT, RBI e-mandate rules, graded ladder | Step 5 |
| R3 | **Stopping rules** | 9 hard stops, enforced in a gate every case must pass | Step 5 |
| R4 | **Audit trail** | Hash-chained append-only event log + per-case timeline export | Step 7 |

**The trap most teams will fall into:** building a pretty dunning-email generator and claiming "₹4.2L recovered." Gross recovery is meaningless — a chunk of those customers would have paid anyway. Our headline number is **incremental** recovery vs. holdout. That single decision is our biggest scoring edge.

---

## 2. Scope

### 2.1 The four leak surfaces (all four, unified)

| Surface | Trigger event | Typical root causes | Money shape |
|---|---|---|---|
| **A. Payment failure / involuntary churn** | charge declined | insufficient funds, expired/blocked card, issuer soft decline, gateway or network degradation, 3DS/OTP drop-off | recurring MRR, high volume, low ticket |
| **B. Checkout abandonment** | session dies pre-authorisation | price/shipping shock, form friction, preferred method absent, OTP timeout, trust gap, distraction | one-shot, very high volume |
| **C. Mandate / subscription breakage** | autopay silently stops | mandate revoked, debit cap exceeded, pre-debit notice failure, bank downtime, account closed | recurring, silent, deadliest |
| **D. B2B receivables** | invoice past due | PO/GRN mismatch, invoice never reached AP, approval stuck, disputed line item, genuine cash crunch | low volume, huge ticket, relationship-sensitive |

**Why all four, not one:** the differentiator is a *single* risk object model and *one* policy engine serving four very different surfaces. It shows the architecture generalises. A team that only does dunning emails has built a feature; we're building the loop.

### 2.2 Explicitly out of scope (say this on stage — it reads as maturity)
- Real money movement. All gateway calls are mock adapters against a simulator.
- Real outbound comms to real people. Channels are simulated; transcripts and payloads are generated and inspectable.
- Fraud/chargeback defence, tax, dispute adjudication.
- Production-grade auth/multi-tenancy.

### 2.3 Design pillars (non-negotiable)
1. **Diagnose before you act.** A retry on "insufficient funds" and a retry on "expired card" are different products. Wrong intervention burns goodwill *and* gateway trust score.
2. **Bounded by construction.** Every workflow declares max attempts, cooldowns, channel caps, quiet hours, exit criteria — before it runs.
3. **Compliance is a rail, not a checkbox.** It sits in the execution path; nothing reaches a channel without passing the gate.
4. **Measured, not claimed.** Holdout on every batch.
5. **Audit by construction.** You cannot take an action without writing an event. Logging is not a side effect; it's the transaction.
6. **Suppression is a success.** Correctly *not* contacting someone (systemic outage, active promise-to-pay, dispute open) is a first-class outcome we count and display.

---

## 3. Target architecture

```
  SOURCES              DETECT              DIAGNOSE            DECIDE               EXECUTE             PROVE
┌──────────┐        ┌────────────┐     ┌────────────┐     ┌─────────────┐     ┌─────────────┐    ┌────────────┐
│ payments │        │  signal    │     │ root-cause │     │  policy     │     │  bounded    │    │ recovery   │
│ checkout │ ─────▶ │  extractor │ ──▶ │ classifier │ ──▶ │  engine     │ ──▶ │  workflow   │──▶ │ ledger +   │
│ mandates │        │  + scorer  │     │ + evidence │     │  (EV-based  │     │  runner     │    │ holdout    │
│ invoices │        │  + dedupe  │     │ + systemic │     │   playbook) │     │  + GATE     │    │ analytics  │
└──────────┘        └────────────┘     └────────────┘     └─────────────┘     └─────────────┘    └────────────┘
                          │                   │                   │                   │                 │
                          └───────────────────┴─────────┬─────────┴───────────────────┴─────────────────┘
                                                        ▼
                                     APPEND-ONLY HASH-CHAINED AUDIT LOG  (every decision, every reason code)
                                                        ▲
                                     SIMULATED ECONOMY  │  hidden ground truth → outcome resolver
```

### 3.1 The central abstraction: `RiskItem`
One object type for all four surfaces. Everything downstream is surface-agnostic.

```
RiskItem {
  id, surface (A|B|C|D), customer_id, source_ref
  exposure_paise            // money at stake
  p_loss                    // probability it never arrives unaided
  urgency                   // time-decay factor
  risk_score = p_loss × exposure × urgency
  first_seen_at, state, cohort (TREATMENT|HOLDOUT)
}
```

### 3.2 Tech stack (chosen for hackathon velocity)
| Layer | Choice | Rationale |
|---|---|---|
| Runtime | **Bun + TypeScript** | one language end-to-end, fast, zero build config |
| Store | **SQLite** (Postgres-compatible DDL) | file-based, portable, trivially resettable between demo runs |
| Engines | plain TS modules, pure functions | deterministic + unit-testable; no framework tax |
| LLM | used **only** on the ambiguous residual (B2B email threads, dispute notes, Hinglish copy, voice scripts) | rules where rules win; models where language wins |
| UI | single-page dashboard (React/HTML) reading the DB | drill-down is the demo |
| Orchestration | CLI: `bun run batch --date X` | reproducible, scriptable, demoable |

**Architectural rule:** the engines never touch the `ground_truth` table. Only the outcome resolver may. This keeps our own measurement honest and is worth stating explicitly in the README.

---

## 4. Data model (Step 1 defines this in full)

**Facts (the world):** `customers` · `subscriptions` · `mandates` · `payment_attempts` · `checkout_sessions` · `invoices` · `gateway_health`

**Agent state (what we produce):** `risk_items` · `diagnoses` · `intervention_plans` · `plan_steps` · `gate_decisions` · `communications` · `promises_to_pay` · `recoveries` · `audit_events` · `incidents`

**Simulator only:** `ground_truth` — latent per-customer pay propensity by channel, time-decay curve, price sensitivity, max tolerable contacts, and a "would have paid anyway" flag. This is what makes holdout measurement real rather than theatre.

**Money rule:** all amounts stored as integer **paise**. No floats, ever. Currency INR.

---

## 5. The build — 10 steps

Each step is independently shippable, writes artefacts to disk, and ends with a state update so work resumes cleanly the next day.

> **Effort key:** S ≈ 1–2h · M ≈ 3–4h · L ≈ 5–6h

---

### **Step 1 — Domain model + simulated economy** · `L` · 🔴 critical path
**Why first:** without a realistic, *resolvable* world you cannot prove recovery. The simulator holds hidden truth so every later step is objectively scoreable.

**Tasks**
1. Write full DDL for all tables above.
2. Build the seeder: ~1,200 customers across B2C / SMB / Enterprise, with consent flags, language preference (EN / HI / Hinglish), timezone, DND status.
3. Generate a realistic Indian payment mix — UPI Autopay, eNACH, cards, netbanking — with **real-world decline-code distributions** (insufficient funds ~35%, expired/invalid card ~15%, issuer soft decline ~20%, technical/gateway ~15%, mandate issues ~10%, hard/fraud ~5%).
4. Inject a **deliberate systemic incident**: one gateway × issuer combination degrades for a 6-hour window. This is the set-piece for the demo.
5. Generate checkout sessions with stage-of-drop-off, invoices with realistic ageing buckets (0–30 / 31–60 / 61–90 / 90+), and B2B disputes.
6. Build `ground_truth`: latent propensity, channel affinity, time-decay, discount sensitivity, contact tolerance, `would_pay_anyway` flag.

**Deliverables:** `db/schema.sql` · `scripts/seed.ts` · `data/recovery.db` · `docs/DATA_DICTIONARY.md` · seed summary report
**Acceptance:** batch of ≥1,000 risk-bearing events, total ₹ at risk printed by surface; re-runnable with a fixed seed for identical results.

---

### **Step 2 — Detection engine** · `M`
**Tasks**
1. Signal extractors per surface: failed charge, session abandoned > T minutes, mandate anomaly, invoice past due-date bucket.
2. **Degradation detector** — rolling success rate per (gateway × method × issuer × BIN) with z-score / CUSUM over a trailing baseline. Distinguishes *"our plumbing broke"* from *"this customer has no money."* ← **the differentiator; do not cut this.**
3. Risk scoring: `p_loss × exposure × urgency`, calibrated per surface.
4. Entity resolution + dedupe so one customer with three failures isn't chased three times.
5. Cohort assignment: stratified randomised split into TREATMENT / HOLDOUT (default 15%), by segment × surface × exposure band.

**Deliverables:** `engines/detect.ts` · populated `risk_items` · `out/detection_report.md`
**Acceptance:** every seeded loss event maps to exactly one risk item; the injected outage is flagged as an incident, not 40 angry dunning emails.

---

### **Step 3 — Diagnosis engine** · `M`
**Tasks**
1. Deterministic decline-code → root-cause map (high precision, covers ~80%).
2. Behavioural inference for checkout (drop stage + device + cart value → cause).
3. **LLM reasoning on the ambiguous residual only:** B2B email threads, free-text dispute notes, mixed signals. Structured output: `{root_cause, confidence, evidence[]}`.
4. `is_systemic` flag — if the cause is our infrastructure, route to ops and **suppress all customer contact**.
5. Emit human-readable evidence strings for the audit trail ("card BIN 4532 expired 12/25; 2 prior successes on this card; customer active 14 months").

**Deliverables:** `engines/diagnose.ts` · `diagnoses` table · confusion matrix vs. seeded truth
**Acceptance:** ≥85% root-cause accuracy against ground truth; 100% of outage-window failures marked systemic.

---

### **Step 4 — Policy / playbook engine** · `L` · 🔴 critical path
**The brain. This is where "AI" stops being a chatbot and becomes a decision-maker.**

**Playbook library**
| Playbook | Best for | Key mechanic |
|---|---|---|
| Smart retry | insufficient funds | **salary-cycle aware** — retry on 1st/2nd or the customer's observed credit day, not blind T+24h |
| Card updater / re-auth link | expired card | one-tap update, no dunning tone |
| Mandate re-authorisation | mandate revoked / cap exceeded | RBI-compliant pre-debit notice + AFA link |
| One-tap UPI link | any B2C failure | lowest friction recovery path in India |
| Dunning ladder | soft declines | graded email → SMS → WhatsApp → voice |
| **Hinglish voice call** | low-digital-literacy segment, high value | LLM-scripted, consent-gated, quiet-hours-bound |
| Cart recovery | checkout drop | cause-specific: shipping offer vs. method-add vs. simple nudge |
| Partial payment / instalment | genuine cash crunch | preserve the relationship |
| **Promise-to-pay capture** | B2B | log the promise, set the follow-up, track kept-rate |
| Discount / waiver | high-LTV at risk | **hard budget cap**, requires EV justification |
| Human / collections handoff | high value, stuck, or emotional | escalate with a full brief |

**Selection logic — expected value, not vibes:**
```
EV(playbook) = P(recover | cause, channel, segment, history) × exposure
             − channel_cost − goodwill_cost − discount_cost
choose argmax EV, subject to gate constraints; skip if EV ≤ 0
```
Timing is a first-class decision, not a fixed cron. Output an ordered, scheduled ladder with explicit exit criteria per step.

**Deliverables:** `engines/policy.ts` · `playbooks/*.ts` · `intervention_plans` + `plan_steps` · `out/policy_rationale.md`
**Acceptance:** every plan carries a written EV rationale; negative-EV items are provably skipped (and counted as savings).

---

### **Step 5 — Guardrails & compliance layer** · `M` · 🔴 critical path (R2 + R3)
**Every outbound action passes through one `gate()` function. No exceptions, no bypass path.**

**Compliance rails**
- Consent registry + DND / opt-out honoured instantly and permanently.
- **Quiet hours** by customer timezone; voice calls restricted to **08:00–19:00** per RBI Fair Practices norms.
- TRAI **DLT**-registered template binding for SMS — no template ID, no send.
- **RBI e-mandate:** 24-hour pre-debit notification before any autopay retry; AFA required above ₹15,000.
- DPDP-aligned data minimisation in message payloads.
- Frequency caps: per channel, per day, per week, plus a global cooldown.
- Tone ladder — never threatening; escalation changes *channel and specificity*, never aggression.

**The nine stopping rules**
`PAID` · `PROMISE_TO_PAY_ACTIVE` · `DISPUTE_OPEN` · `OPTED_OUT` · `SYSTEMIC_INCIDENT` · `MAX_ATTEMPTS_REACHED` · `NEGATIVE_EV` · `FRAUD_OR_BANKRUPTCY_FLAG` · `HUMAN_TAKEOVER`

Every gate decision — allow *and* block — is logged with a reason code. **The blocks are the story.** A dashboard tile reading *"1,847 contacts suppressed by compliance rails"* is more persuasive than any recovery number.

**Deliverables:** `engines/gate.ts` · `gate_decisions` table · `docs/COMPLIANCE.md` · suppression report
**Acceptance:** zero sends outside quiet hours; zero sends to opted-out contacts; zero customer contact during the injected outage; all nine stops demonstrably firing at least once in the batch.

---

### **Step 6 — Bounded execution runner** · `M`
**Case state machine**
```
DETECTED → DIAGNOSED → PLANNED → GATED → EXECUTING
                                            ├─▶ RECOVERED
                                            ├─▶ PARTIALLY_RECOVERED
                                            ├─▶ PROMISED (→ follow-up scheduled)
                                            ├─▶ ESCALATED_TO_HUMAN
                                            ├─▶ SUPPRESSED (compliance / systemic)
                                            └─▶ CLOSED_LOST
```
**Tasks**
1. Idempotent step execution keyed on `(case_id, step_no)` — replay-safe.
2. Scheduler with backoff, jitter, and the salary-cycle-aware retry calendar.
3. Mock adapters: email, SMS, WhatsApp, voice (transcript), gateway charge, payment link.
4. LLM message generation per cause × segment × language, including Hinglish voice scripts.
5. **Outcome resolver** — the only module allowed to read `ground_truth`; decides what actually happened and writes to `recoveries`.
6. Continuous re-evaluation: if a customer pays mid-ladder, the remaining steps are cancelled immediately.

**Deliverables:** `engines/execute.ts` · `adapters/*` · `communications` + `recoveries` tables
**Acceptance:** full batch runs end-to-end; no case exceeds its declared attempt budget; mid-ladder payment cancels remaining steps every time.

---

### **Step 7 — Audit trail** · `S` · (R4)
**Tasks**
1. `audit_events`: append-only, each row carrying `prev_hash` and `hash` → tamper-evident chain.
2. Every event records: actor (agent / human / system), action, inputs digest, decision, reason codes, **policy version + model version**, timestamp.
3. `verify_chain()` CLI — recompute the chain and prove integrity live on stage.
4. Per-case timeline exporter (JSON + printable) answering: *"why did the agent call this customer at 6pm on Tuesday?"* in one click.

**Deliverables:** `engines/audit.ts` · `out/audit_case_<id>.md` · chain verification command
**Acceptance:** every state change and every gate decision has an event; chain verifies; tampering with one row is detected.

---

### **Step 8 — Measurement harness** · `M` · 🔴 critical path (R1)
**The headline metric:** **incremental ₹ recovered = treatment recovery rate − holdout recovery rate, × treatment exposure.**

**Metric set**
| Metric | Why it matters |
|---|---|
| ₹ at risk → ₹ recovered (waterfall by surface & cause) | the story in one image |
| **Incremental lift vs holdout** (with confidence interval) | the honest number |
| Recovery rate, time-to-cash, DSO delta | operational credibility |
| Cost per ₹ recovered | proves it's profitable, not just active |
| Contacts per recovery | proves efficiency |
| Opt-out rate, complaint rate | proves we're not burning the base |
| False-positive dunning rate | proves precision |
| Suppressed-by-guardrail count | proves compliance |

**Tasks:** stratified holdout analysis · bootstrap confidence intervals · counterfactual "what a naive fixed 3-retry dunning system would have recovered" baseline (this comparison is a killer slide) · `out/batch_report.md` + JSON.
**Acceptance:** a single command prints a defensible ₹ figure with a CI and a named baseline comparison.

---

### **Step 9 — Demo surface** · `M`
1. **Batch overview:** ₹ at risk → ₹ recovered waterfall; splits by surface and root cause.
2. **Live run:** watch a batch process, cases flowing through the state machine.
3. **Case drill-down:** full timeline, diagnosis + evidence, EV rationale, every gate decision, generated message copy, outcome.
4. **Compliance panel:** suppressions by reason, stopping rules fired, quiet-hours enforcement.
5. **Incident banner:** the injected outage detected, ops alerted, customer contact suppressed. ← **the mic-drop moment.**
6. **Holdout comparison** front and centre.

**Acceptance:** a judge can go from headline ₹ to a single customer's full decision trail in under three clicks.

---

### **Step 10 — Pitch package** · `S`
3-minute demo script · README with setup · architecture diagram · metrics one-pager · **"what's real vs simulated"** honesty slide · known limitations & what production would need.

---

## 6. Suggested 5-day schedule

| Day | Steps | Outcome at end of day |
|---|---|---|
| **1** | 1 | A living simulated economy with hidden truth. Total ₹ at risk is a real number. |
| **2** | 2 + 3 | Every leak detected, deduped, scored, and diagnosed. Outage caught. |
| **3** | 4 + 5 | The brain and the rails. Plans exist; nothing illegal or rude can escape. |
| **4** | 6 + 7 + 8 | End-to-end batch runs. Money recovered. Audit chain verifies. **Demo-complete.** |
| **5** | 9 + 10 | Dashboard, polish, rehearsed pitch. |

**Buffer strategy:** Steps 1, 4, 5, 8 are the critical path — they *are* the four scoring requirements. Step 9's dashboard can degrade to a well-formatted terminal report and markdown artefacts without losing a single point on the stated bar. Cut UI polish before cutting measurement.

---

## 7. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Simulator feels fake, judges discount results | High | Real decline-code distributions, real RBI/TRAI rules, an honest "simulated" slide. Own it loudly rather than being caught. |
| Scope creep across four surfaces | High | The unified `RiskItem` model. If time runs short, ship surfaces A + D fully (highest ₹ per case) and demo B + C. |
| LLM latency/cost in the batch loop | Medium | Rules handle ~80%; LLM on the residual only; cache by (cause × segment × language). |
| Holdout too small to be significant | Medium | 15% stratified, ≥1,000 items, report confidence intervals honestly. |
| Building a pretty dunning tool, not a decision engine | **Fatal** | The EV rationale and the suppression count are mandatory demo elements. |
| Day-5 crunch | Medium | Demo-complete by end of Day 4, by design. |

---

## 8. The five things that win this track

1. **Incremental, holdout-measured recovery** — while everyone else reports gross.
2. **Systemic-degradation detection** — the agent that knows when *not* to blame the customer.
3. **Expected-value intervention selection with a written rationale** — visible reasoning, not a template picker.
4. **A visible compliance layer where suppressions are celebrated** — "1,847 contacts blocked" as a feature.
5. **A tamper-evident audit chain you verify live on stage.**

---

## 9. Resume protocol
`docs/STATE.md` is the single source of truth for progress. Read it first, execute the next unchecked step, update it before stopping. Every step writes its artefacts to `out/` so nothing lives only in conversation.
