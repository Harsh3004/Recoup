# Recoup — Complete Project Knowledge Document

> **Purpose of this document:** A complete, file-by-file technical walkthrough of the Recoup project — what every file does, how it was built, what technologies were chosen and why, how data flows through the system, and why every design decision was made the way it was.

---

## Table of Contents

1. [Project Overview & Core Philosophy](#1-project-overview--core-philosophy)
2. [Technology Stack & Why Each Was Chosen](#2-technology-stack--why-each-was-chosen)
3. [Project Structure Map](#3-project-structure-map)
4. [The Database Layer — `db/schema.sql`](#4-the-database-layer--dbschemasql)
5. [Core Utilities — `src/`](#5-core-utilities--src)
6. [Simulation Constants — `src/sim/`](#6-simulation-constants--srcsim)
7. [The Seeder — `scripts/seed.ts`](#7-the-seeder--scriptsseedts)
8. [Engine 1 — Detection — `engines/detect.ts`](#8-engine-1--detection--enginesdetectts)
9. [Engine 2 — Diagnosis — `engines/diagnose.ts`](#9-engine-2--diagnosis--enginesdiagnosets)
10. [Engine 3 — Policy — `engines/policy.ts`](#10-engine-3--policy--enginespolicyts)
11. [Playbook System — `playbooks/`](#11-playbook-system--playbooks)
12. [Engine 4 — Gate — `engines/gate.ts`](#12-engine-4--gate--enginesgatets)
13. [Mock Adapters — `adapters/`](#13-mock-adapters--adapters)
14. [Engine 5 — Execution & Outcome Resolver — `engines/execute.ts`](#14-engine-5--execution--outcome-resolver--enginesexecutets)
15. [Engine 6 — Audit Verifier — `engines/audit.ts`](#15-engine-6--audit-verifier--enginesauditts)
16. [Engine 7 — Measurement Harness — `engines/measure.ts`](#16-engine-7--measurement-harness--enginesmeasurets)
17. [Evaluation Script — `scripts/eval_diagnose.ts`](#17-evaluation-script--scriptseval_diagnosets)
18. [The Demo Server — `server/index.ts`](#18-the-demo-server--serverindexts)
19. [The Dashboard — `web/`](#19-the-dashboard--web)
20. [Test Suite — `test/gate.test.ts`](#20-test-suite--testgatetestts)
21. [Configuration Files](#21-configuration-files)
22. [Documentation Layer — `docs/`](#22-documentation-layer--docs)
23. [Complete Data Flow: Seed → Dashboard](#23-complete-data-flow-seed--dashboard)
24. [Key Design Decisions & Why](#24-key-design-decisions--why)

---

## 1. Project Overview & Core Philosophy

**Recoup** is an autonomous failed-payment recovery and compliance engine built for the Razorpay Hackathon. The project answers one question: *can a software agent diagnose why a payment failed, choose the right recovery action, and prove via statistics that it actually created real incremental value — not just take credit for payments that would have happened anyway?*

### The Four Scoring Requirements (R1–R4)
The hackathon judges evaluate on four axes:
- **R1:** Net incremental ₹ recovered (proven via a randomized holdout, not gross collections)
- **R2:** Strict compliance rails (zero sends to opted-out/outage-affected customers)
- **R3:** Tone ladder and quiet hours (no calls at 2am, no coercive language)
- **R4:** Tamper-evident audit trail (cryptographic proof of every decision)

### Ground Rules Set from Day 1
These rules were established before a single line of code was written:
1. **Money is always integer paise.** Never floats, never rupees as decimals. A float-based money bug can crash a live collection system.
2. **Ground truth is sacred.** The tables that store whether a customer would have paid anyway are completely off-limits to all engines except the sole authorized Outcome Resolver in `execute.ts`. This is what makes the measurement honest.
3. **Every action goes through the gate.** No engine can directly dispatch a communication. All actions pass through a single `gate()` function.
4. **Audit by construction.** Every state change in the system creates an audit event, not as an afterthought but as the primary path.
5. **Determinism by seed.** All randomness goes through a seeded PRNG. Given the same seed, the exact same 1,200 customers, 13,626 payment attempts, and outcome resolution will be produced on any machine.

---

## 2. Technology Stack & Why Each Was Chosen

| Technology | What It Is | Why Used |
|---|---|---|
| **Bun** | JavaScript runtime (drop-in Node.js replacement) | Native TypeScript execution without a build step; built-in SQLite module (`bun:sqlite`); dramatically faster startup vs. Node+tsx; single binary with test runner included |
| **TypeScript (strict)** | Typed superset of JavaScript | `noUncheckedIndexedAccess: true` and `strict: true` catch integer domain bugs at compile time; interfaces document engine contracts explicitly |
| **SQLite (via `bun:sqlite`)** | Embedded relational database | Zero-dependency database — judges can reproduce everything with `bun install` and no external services; WAL mode enables concurrent reads; foreign keys and CHECK constraints enforce data integrity at the storage layer |
| **`node:crypto`** | Node.js built-in hashing module | SHA-256 hash chaining for audit ledger — no npm dependency needed, crypto is part of the runtime |
| **`Intl.DateTimeFormat`** | Browser/Node standard API | Timezone-correct quiet hours enforcement — converts Unix timestamps to the customer's local hour without any npm dependency |
| **Vanilla HTML/CSS/JS** | Web standards | Dashboard has zero build step; judges can open a single HTML file and understand the entire UI; no framework magic to hide bugs |

**What was explicitly NOT used:**
- No ORM (direct SQL gives full control and is auditable)
- No message queue (the pipeline is synchronous and deterministic)
- No external services (everything runs offline)
- No npm packages beyond `@types/bun` for TypeScript types

---

## 3. Project Structure Map

```
d:/Code/Razorpay/
│
├── db/
│   └── schema.sql              ← Single source of truth for all tables
│
├── src/                        ← Pure utility modules (no IO, no DB side effects)
│   ├── audit.ts                ← SHA-256 hash chain write helper
│   ├── db.ts                   ← Database connection factory
│   ├── money.ts                ← Integer paise helpers & validation
│   └── sim/
│       ├── constants.ts        ← All simulation config (decline codes, plans, cities)
│       ├── names.ts            ← Indian name generation data
│       └── rng.ts              ← Seeded xorshift32 PRNG class
│
├── scripts/
│   ├── seed.ts                 ← Step 1: Generate the entire simulated economy
│   └── eval_diagnose.ts        ← Offline accuracy benchmark for diagnose engine
│
├── engines/                    ← The six pipeline stages
│   ├── detect.ts               ← Step 2: Signal extraction + anomaly detection
│   ├── diagnose.ts             ← Step 3: Root-cause classifier
│   ├── policy.ts               ← Step 4: EV maximization + playbook selection
│   ├── gate.ts                 ← Step 5: Universal compliance gatekeeper
│   ├── execute.ts              ← Step 6: Dispatch + Outcome Resolver
│   ├── audit.ts                ← Step 7: Hash chain verifier + case timeline exporter
│   └── measure.ts              ← Step 8: Counterfactual lift + bootstrap CI
│
├── playbooks/                  ← 11 pluggable recovery strategies
│   ├── types.ts                ← Shared PlaybookEvaluator interface
│   ├── index.ts                ← Registry: ALL_PLAYBOOKS array
│   └── [playbook_name].ts      ← Individual playbook logic (one file each)
│
├── adapters/                   ← Mock communication dispatchers
│   ├── types.ts                ← AdapterMessageInput / Output interfaces
│   ├── payment_link.ts         ← Generates deterministic payment URLs
│   ├── email.ts                ← Email payload formatter
│   ├── sms.ts                  ← SMS payload formatter (TRAI DLT-aware)
│   ├── whatsapp.ts             ← WhatsApp CTA button payload formatter
│   ├── voice.ts                ← Voice call transcript generator (Hinglish)
│   ├── gateway.ts              ← Gateway retry charge payload formatter
│   └── index.ts                ← Re-exports + dispatchMockAdapter() router
│
├── server/
│   └── index.ts                ← Bun HTTP server: serves API + static dashboard
│
├── web/
│   ├── index.html              ← Single-page dashboard (no framework)
│   ├── styles.css              ← Dark-mode premium CSS
│   └── app.js                  ← Client-side JS: fetch + render
│
├── test/
│   └── gate.test.ts            ← 11 unit tests for all 9 stopping rules
│
├── data/                       ← (gitignored) SQLite DB lives here at runtime
├── out/                        ← Generated reports (committed to git)
├── docs/                       ← Hand-authored documentation (committed to git)
│
├── package.json                ← npm scripts for the full pipeline
├── tsconfig.json               ← TypeScript config (strict mode)
├── .gitignore                  ← Excludes DB binary, includes docs & out
└── README.md                   ← Entry point for judges
```

---

## 4. The Database Layer — `db/schema.sql`

**What it is:** The single source of truth for the entire data model. 380 lines of SQLite-compatible DDL that defines every table, constraint, index, and trigger in the system.

**How it was built:**
The schema is structured in four logical sections:

### Section 1 — Facts (The World)
These tables represent real-world business objects that the seeder populates:

| Table | What It Stores | Key Design |
|---|---|---|
| `customers` | 1,200 synthetic Indian businesses across B2C/SMB/Enterprise | `fraud_flag`, `bankruptcy_flag`, `opted_out`, `dnd`, `consent_*` columns enforce compliance at the data layer |
| `subscriptions` | Recurring billing plans (₹99–₹49,999/month) | `status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED')` enforced by CHECK |
| `mandates` | UPI Autopay / eNACH / card mandates | `break_reason` is a constrained enum; `last_pre_debit_notice_at` for RBI 24h rule |
| `payment_attempts` | All 13,626 charge attempts | `in_outage_window` and `open_failure` flags set by seeder to enable fast anomaly detection queries |
| `checkout_sessions` | 500 abandoned checkout sessions | `drop_stage` + `drop_reason` enable the Surface B diagnosis |
| `invoices` | 363 B2B invoices with ageing | `email_thread` TEXT field stores simulated AP email correspondence for LLM-style regex classifier |
| `gateway_health` | Hourly/daily success-rate rollups per gateway×issuer | Enables the sliding-window z-score anomaly detection in `detect.ts` |

### Section 2 — Agent State (Produced by Later Steps)
These tables start empty after seeding and get filled by the pipeline engines:

| Table | Filled by | Purpose |
|---|---|---|
| `risk_items` | `detect.ts` | One row per stalled-rupee event; has `cohort` (TREATMENT/HOLDOUT), `state`, and `incident_id` |
| `diagnoses` | `diagnose.ts` | Root cause + evidence chain per risk item |
| `intervention_plans` | `policy.ts` | Selected playbook + EV rationale per risk item |
| `plan_steps` | `policy.ts` | The multi-step communication ladder (step 1: SMS, step 2: WhatsApp, etc.) |
| `gate_decisions` | `gate.ts` | Every allow/block decision with reason code |
| `communications` | `execute.ts` | Every message formatted and dispatched |
| `promises_to_pay` | `execute.ts` | B2B payment commitments captured |
| `recoveries` | `execute.ts` | Every actual recovery event (Treatment + Holdout) |
| `incidents` | `detect.ts` | Detected systemic outages |
| `audit_events` | Every engine | The immutable SHA-256 hash chain |

### Section 3 — Simulator Only (Ground Truth)
```sql
-- Comment in schema says: "Engines except the Step 6 outcome resolver must not read."
CREATE TABLE ground_truth ...
CREATE TABLE ground_truth_events ...
```
These two tables store hidden data that the simulation knows but the recovery engines must not: whether each customer would pay anyway, their payment propensity, channel affinity, and hours until unassisted resolution. This isolation is what makes the A/B measurement honest.

### Section 4 — The Append-Only Triggers
```sql
CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;
```
These database-level triggers make it **physically impossible** to modify or delete any audit event, even if code bugs or deliberate tampering attempts it. The SQLite engine itself will abort the transaction.

**Why this design:** By putting constraints at the database level (CHECK, FOREIGN KEY, TRIGGER) rather than only in application code, the system is self-defending. A bug in any engine that produces a bad value will be caught by the database before it commits, giving a clear error instead of silent data corruption.

---

## 5. Core Utilities — `src/`

### `src/db.ts` — Database Connection Factory
**What it does:** Opens a SQLite database with three pragmas always applied:
```typescript
db.exec("PRAGMA foreign_keys = ON;");   // FK violations abort transactions
db.exec("PRAGMA journal_mode = WAL;");  // Write-Ahead Log: concurrent reads while writing
db.exec("PRAGMA synchronous = NORMAL;"); // Performance: fsync on checkpoint only
```
Every engine calls `openDb()` to get a connection — ensuring all three pragmas are always set. The `resetDbFile()` helper cleanly deletes the WAL and SHM sidecar files on re-seed.

**Why WAL mode:** Without WAL, the default journal mode locks the entire database file during writes. With WAL, the dashboard server can read the database while the pipeline is executing — crucial for demo purposes.

---

### `src/money.ts` — Integer Paise Helpers
**What it does:** Four functions that enforce the "no floats ever" rule:

```typescript
assertPaise(paise)      // throws if not an integer — called on every monetary input
rupeesToPaise(rupees)   // throws if rupees is fractional
formatInr(paise)        // converts 92695084 → "₹9,26,95,084.00" using Indian number grouping
sumPaise(values[])      // reduces a list of integer paises, re-checks integrality at end
```

**Why the Indian number formatting is custom:** JavaScript's `Intl.NumberFormat` groups with the Indian convention (2-digit groups after the first 3) — `₹9,26,95,084` not `₹92,695,084`. The regex `rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")` implements exactly this grouping for the last 3 digits as a special case, then applies 2-digit grouping to the rest.

**Why not use `Intl.NumberFormat` directly:** It was simpler and more controllable to implement the Indian grouping manually than to rely on locale configuration that may vary across Node/Bun versions.

---

### `src/audit.ts` — Hash Chain Writer
**What it does:** The single function `appendAudit(db, input)` that every engine must call to record a decision. It:

1. Reads `MAX(seq)` from `audit_events` and increments to get the next sequence number
2. Reads the last hash from `audit_events ORDER BY seq DESC`
3. Constructs a canonical JSON payload (keys sorted alphabetically for determinism)
4. Computes `SHA-256(prevHash + "|" + canonical(payload))`
5. Inserts the event with its hash

The `canonical()` function is critical:
```typescript
function canonical(value: unknown): string {
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(obj).sort();  // ← sorted keys = deterministic output
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}
```
Without sorted keys, `{"a":1,"b":2}` and `{"b":2,"a":1}` would produce different hashes for identical data.

**Why hash chaining instead of just signing:** Hash chaining creates a linked list where each event commits to the entire history before it. A chain hash `H_n = SHA256(H_{n-1} | payload_n)` means you cannot change any past event without invalidating all subsequent hashes. An attacker would need to recompute the entire chain from the tampered point forward — and the verifier will catch the mismatch at the first broken link.

---

## 6. Simulation Constants — `src/sim/`

### `src/sim/rng.ts` — Seeded PRNG
**What it is:** A pure TypeScript implementation of the **xorshift32** algorithm:
```typescript
uint32(): number {
  let x = this.s;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  this.s = x >>> 0;
  return this.s;
}
```
All stochastic decisions in the seeder and execution runner go through this class:
- `rng.bool(pBps)` — true with probability `pBps/10000` (e.g., `rng.bool(6500)` = 65% chance)
- `rng.weighted(items)` — picks from a list with integer weights (e.g., `[["UPI",45],["CARD",25]]`)
- `rng.int(min, max)` — inclusive integer range
- `rng.pick(arr)` — uniform pick from array

**Why xorshift32 and not `Math.random()`:** `Math.random()` is non-deterministic (different seed per process). xorshift32 is fast (3 XOR operations), has good statistical properties, and most importantly is seeded — the same seed always produces the same sequence of random numbers. This makes the entire simulation reproducible.

**Why integer arithmetic:** `rng.bool(pBps)` uses `uint32() % 10000 < pBps` — entirely integer. No float division, no floating-point imprecision in probability calculations.

---

### `src/sim/constants.ts` — Simulation Configuration
**What it is:** All the parameters that define the simulated Indian payment economy in one place — 302 lines of exported constants. Key sections:

- **Decline taxonomy:** `DECLINE_CATEGORY_WEIGHTS` = `[["INSUFFICIENT_FUNDS", 35], ["EXPIRED_CARD", 15], ...]` — the percentage split of decline categories matches real Indian payment failure distributions
- **Incident definition:** `INCIDENT = { gateway: "razorpay", issuer: "HDFC", startIso: "2026-08-19T10:00:00+05:30", endIso: "2026-08-19T16:00:00+05:30" }` — the injected 6-hour outage window
- **DLT Templates:** Pre-registered TRAI templates with entity ID `RECOUP_DLT_110001` — the seeder populates the `dlt_templates` table from these constants
- **Subscription plans:** B2C plans from ₹99–₹1,499/month, SMB ₹2,999–₹9,999, Enterprise ₹24,999–₹49,999 quarterly
- **Timezones:** `[["Asia/Kolkata", 92], ["Asia/Dubai", 4], ["Europe/London", 2], ["America/New_York", 2]]` — NRI slice enables quiet-hours testing across timezones
- **`POLICY_VERSION` / `MODEL_VERSION`:** Stamped on every audit event, enabling future A/B comparison of policy versions

**Why a single constants file:** Any change to the simulated economy (new decline category, new plan tier) is made in one place and immediately affects the seed, detection, diagnosis, and policy engines consistently.

---

### `src/sim/names.ts`
Contains arrays of realistic Indian first names, last names, and company names used by the seeder to generate customer identities.

---

## 7. The Seeder — `scripts/seed.ts`

**What it is:** Step 1 of the pipeline. A ~1,500-line script that generates the entire synthetic Indian payment economy from scratch, starting from seed `42`.

**How it works:**

### Phase 1: Schema Application
Calls `resetDbFile()` then `applySchema()` — completely wipes and recreates the database. This makes the seeder idempotent and resume-safe.

### Phase 2: Customer Generation (1,200 customers)
For each customer, using the seeded RNG:
- Segment assigned: 900 B2C, 240 SMB, 60 Enterprise (from `SEGMENT_COUNTS`)
- Name drawn from Indian names pool
- Language picked from `LANGUAGES` weighted distribution (EN 40%, HINGLISH 35%, HI 25%)
- Timezone picked (92% IST, 4% Dubai, 2% London, 2% NY)
- Compliance flags set: ~7.5% DND, ~3.3% opted-out, ~0.7% fraud, ~0.5% bankruptcy
- `ground_truth` row inserted per customer (hidden propensity score, channel affinity JSON, would-pay-anyway flag)

### Phase 3: Subscriptions & Mandates (877 each)
B2C and SMB/Enterprise customers get subscriptions with plan amounts from the constants. Each subscription links to a mandate (UPI/ENACH/CARD/NETBANKING).

### Phase 4: Payment Attempt Generation (13,626 attempts)
This is the most complex phase:
- Normal failures are seeded by the decline category weights
- **Outage injection:** For the 6-hour `INCIDENT` window on `razorpay × HDFC`, the seeder artificially elevates the failure rate to simulate a real gateway degradation. The `in_outage_window` flag is set on each attempt
- `open_failure = 1` is set for unresolved failures (Surface A source events)

### Phase 5: Checkout & Invoice Generation
- 500 checkout sessions with abandon stages and reasons
- 363 B2B invoices with ageing buckets, dispute types, and simulated email threads

### Phase 6: Gateway Health Rollups
Hour-by-hour success-rate windows for each gateway×issuer pair, computed directly from the `payment_attempts` table. This is what the anomaly detector reads.

### Phase 7: Ground Truth Events
One `ground_truth_events` row per source event (payment_attempt / checkout / mandate / invoice) storing:
- `true_root_cause`: what actually caused the failure
- `would_pay_anyway`: 1 = customer would self-resolve without Recoup
- `hours_until_unassisted`: how long until organic recovery
- `contact_fatigue_bps`: how much repeated contact hurts propensity

### Phase 8: DLT Templates & sim_meta
Seeds the pre-registered TRAI DLT templates from `constants.ts`. Writes `sim_meta` rows for `as_of_ms` (the simulation clock: `2026-08-20T12:00:00+05:30`) and `seed`.

### Phase 9: Fingerprint Verification
Computes an MD5/SHA-based fingerprint over key row counts and sum checks, outputs it to console. `bun run seed:verify` re-seeds with seed 42 and checks that the fingerprint matches — this is how reproducibility is demonstrated.

**Why the seeder is so large:** Because it has to build a realistic world. A simple random dataset would be trivially recoverable; a realistic dataset requires:
- Correlated failure patterns (salary-day effect on NSF failures)
- Correlated compliance constraints (NRI customers need different quiet-hours)
- A realistic B2B world with invoice disputes and AP email threads
- An injected outage that's statistically detectable

---

## 8. Engine 1 — Detection — `engines/detect.ts`

**What it is:** The first engine in the recovery pipeline. Reads raw transactional data and produces structured `risk_items` — one per stalled-rupee event.

**How it works:**

### Step A: Sliding-Window Anomaly Detection
Before creating risk items, detect reads `gateway_health` hourly rollups and runs a **z-score analysis** on each gateway×issuer combination:
```
z = (observed_success_rate - baseline_mean) / baseline_stddev
```
If `z < -3.0` and the window has enough attempts, the engine creates an `incidents` row. This is what detected the `razorpay × HDFC` outage at z = -7.14.

### Step B: Surface A — Payment Failure Extraction
Queries `payment_attempts WHERE open_failure = 1`. For each failure:
- Computes `exposure_paise` (the billed amount)
- Computes `p_loss_bps` (probability of permanent loss) based on decline category
- Computes `urgency_bps` based on subscription amount tier
- Links to `incident_id` if the attempt falls in the outage window
- Assigns `risk_score = (p_loss_bps * exposure_paise * urgency_bps) / 100_000_000n` using BigInt to avoid integer overflow

### Step C: Surfaces B, C, D
Same pattern for checkout sessions (abandoned), mandates (broken/revoked/expired), and invoices (PAST_DUE status).

### Step D: Stratified Holdout Assignment
15% of risk items are randomly assigned to `cohort = 'HOLDOUT'` (the control group). The randomization is stratified — holdout is assigned within each surface×segment stratum to prevent imbalance. The remaining 85% are `cohort = 'TREATMENT'`.

**Why stratified holdout matters:** A completely random 15% holdout could accidentally oversample Surface D (high-value B2B invoices), making the holdout baseline artificially high or low. Stratification ensures proportional representation across all dimensions.

**Output:** `risk_items` table populated, `incidents` table populated, `out/detection_report.md` written.

---

## 9. Engine 2 — Diagnosis — `engines/diagnose.ts`

**What it is:** Diagnoses the root cause of each stalled-rupee event. Returns a structured `DiagnosisOutput` with root cause, confidence (in bps), evidence chain, and a systemic flag.

**How it works — the four-surface classifier:**

### Surface A: Payment Failures — Deterministic Rule-Based
```
if incident_id is not null → SYSTEMIC_GATEWAY_OUTAGE (99% confidence, systemic=true)
if decline_category = 'INSUFFICIENT_FUNDS' → INSUFFICIENT_FUNDS (96% confidence)
if decline_category = 'EXPIRED_CARD' → EXPIRED_CARD (98% confidence)
if decline_category = 'ISSUER_SOFT' and three_ds_dropped = 1 → OTP_DROPOFF (92%)
if decline_category = 'TECHNICAL' → TECHNICAL_TRANSIENT (88%)
if decline_category = 'MANDATE' → [specific mandate code] (94%)
else → FRAUD_OR_BLOCKED (97%)
```
Every branch emits a human-readable evidence chain: `"Issuer decline code 'INSUFFICIENT_FUNDS' — salary credit day is 15th of month"`.

### Surface B: Checkout Abandonment — Behavioural Inference
Reads `drop_stage` and `drop_reason` from `checkout_sessions`. The cause is the `drop_reason` (or inferred from stage if missing). Evidence includes session duration and cart value.

### Surface C: Mandate Breakage — Direct Lookup
The mandate's `break_reason` is the root cause. Evidence includes the method, issuer, and RBI pre-debit notice timing.

### Surface D: B2B Invoices — LLM-Style Regex Classifier
This is the most interesting surface. For invoices with an `email_thread` or `dispute_notes`, the engine runs a regex pattern matcher against the text:
```typescript
if (/GRN|delivery challan|stores confirm/i.test(threadText)) → PO_GRN_MISMATCH
if (/no invoice in the AP inbox|re-send to ap@/i.test(threadText)) → INVOICE_NOT_RECEIVED
if (/budget owner|stuck in queue|approval/i.test(threadText)) → APPROVAL_STUCK
if (/Discrepancy|quantity|rate|line item|credit note/i.test(threadText)) → LINE_ITEM_DISPUTE
if (/cash flow|liquidity|cash crunch|extension/i.test(threadText)) → CASH_CRUNCH
```
These patterns simulate an LLM reading email threads to extract intent. The `llm_used = true` flag is set on these cases, and `model_version = "recoup-llm-residual-v1"` is recorded.

**Why "LLM-style" rather than an actual LLM:** The hackathon is about architecture, not API key management. The regex patterns produce the same classification decisions an LLM would make on the seeded email threads (which were designed to contain these keywords). The flag is honest: it marks that a language-understanding step was used, with the caveat documented in `HONESTY.md`.

**Output:** `diagnoses` table populated, `out/diagnoses_report.md` written.

---

## 10. Engine 3 — Policy — `engines/policy.ts`

**What it is:** The "brain" of Recoup. For each diagnosed risk item, evaluates all eligible playbooks and selects the one with the highest Expected Value (EV).

**The EV Formula:**
```
EV = P(recover | cause, channel, segment) × exposure_paise
   - channel_cost_paise
   - goodwill_cost_paise
   - discount_cost_paise
```
Where `P(recover)` is modelled as `pRecoverBps / 10000` — a probability in basis points.

**How it works:**
1. For each risk item with a diagnosis, the engine iterates over `ALL_PLAYBOOKS` (11 playbooks)
2. Each playbook implements `isApplicable(ctx)` — checks whether it makes sense for this surface/cause/segment
3. For applicable playbooks, `computeEV(ctx)` calculates net expected value
4. The engine selects `argmax EV` — the playbook with the highest expected net value
5. If max EV ≤ 0, the plan is marked `skipped = 1` with `skip_reason = 'NEGATIVE_EV'`
6. For systemic, fraud, and bankruptcy cases: `skipped = 1` with the appropriate reason
7. For the selected playbook, `generateLadder(ctx)` produces the sequence of plan steps

**What a plan step looks like:**
```
Step 1: channel=WHATSAPP, action=SEND_MESSAGE, scheduled_at=T+2h, exit_criteria=PAID
Step 2: channel=SMS, action=SEND_SMS, scheduled_at=T+26h, exit_criteria=PAID
Step 3: channel=VOICE, action=CALL, scheduled_at=T+50h, exit_criteria=PAID
```

**Output:** `intervention_plans` and `plan_steps` tables populated, `out/policy_rationale.md` written.

---

## 11. Playbook System — `playbooks/`

**What it is:** The 11 pluggable recovery strategies. Each is a TypeScript class implementing the `PlaybookEvaluator` interface.

### The Interface (`playbooks/types.ts`)
```typescript
interface PlaybookEvaluator {
  name: PlaybookName;
  isApplicable(ctx: PlaybookContext): boolean;
  computeEV(ctx: PlaybookContext): EVBreakdown;
  generateLadder(ctx: PlaybookContext): PlanStepSpec[];
}
```
`PlaybookContext` contains everything the playbook needs to make decisions: surface, segment, language, digital literacy, root cause, exposure, salary credit day, preferred channel, DND status, etc. — but crucially NOT ground truth.

### The 11 Playbooks

| Playbook | Target | What It Does |
|---|---|---|
| `SMART_RETRY` | Surface A, INSUFFICIENT_FUNDS | Salary-cycle aware retry — schedules attempt after predicted salary credit day |
| `CARD_UPDATER` | Surface A, EXPIRED_CARD | One-tap card update link; high P(recover) because the intent is clear |
| `MANDATE_REAUTH` | Surface C, broken mandate | RBI-compliant AFA re-authorization link |
| `ONE_TAP_UPI` | Surface A, OTP/soft decline | Generates a UPI intent deep-link for Google Pay/PhonePe |
| `DUNNING_LADDER` | All surfaces, general | Generic 3-step email/SMS/WhatsApp escalation ladder |
| `HINGLISH_VOICE` | HINGLISH/HI language, LOW digital literacy | Bilingual voice call script in Hinglish |
| `CART_RECOVERY` | Surface B | WhatsApp cart-recovery message with item summary |
| `PARTIAL_PAYMENT` | Surface D, 90_PLUS ageing, large invoices | Instalment plan offer email |
| `PROMISE_TO_PAY` | Surface D, ENTERPRISE | Formal PTP capture with due-date commitment |
| `DISCOUNT_WAIVER` | Surface D, cash crunch | Small waiver offer to unlock stuck payment |
| `HUMAN_ESCALATION` | High-value disputes | Flags for account manager takeover |
| `SYSTEMIC_SUPPRESSION` | incident_id != null | Zero contact; route to ops team |
| `FRAUD_SUPPRESSION` | fraud/bankruptcy flag | Zero contact; halt recovery |

**Why separate files per playbook:** Each playbook is independently testable and replaceable. Adding a new playbook in production means creating one new file implementing the interface — the policy engine picks it up automatically from `ALL_PLAYBOOKS`.

---

## 12. Engine 4 — Gate — `engines/gate.ts`

**What it is:** The universal compliance gatekeeper. The single most important file for R2 and R3 compliance scoring. No communication can be sent without passing through `gate()`.

**Architecture:**
```
Any Engine ──▶ gate(db, input) ──┬──▶ BLOCK (reasonCode, details)
                                 └──▶ ALLOW (all checks passed)
```

**The `gate()` function — 460 lines of sequential compliance checks:**

Every check returns immediately on failure (early return pattern). The checks in order:

#### 9 Stopping Rules
| Order | Rule | Check Logic |
|---|---|---|
| 1 | `SYSTEMIC_INCIDENT` | `risk.incident_id IS NOT NULL OR is_systemic = 1` |
| 2 | `FRAUD_OR_BANKRUPTCY_FLAG` | `cust.fraud_flag = 1 OR cust.bankruptcy_flag = 1` |
| 3 | `OPTED_OUT` | `cust.opted_out = 1 OR (cust.dnd = 1 AND channel IN ('SMS','VOICE'))` |
| 4 | `NEGATIVE_EV` | `plan.skipped = 1 AND skip_reason = 'NEGATIVE_EV'` |
| 5 | `HUMAN_TAKEOVER` | `plan.playbook = 'HUMAN_ESCALATION' AND channel != 'AGENT'` |
| 6 | `DISPUTE_OPEN` | `surface = 'D' AND invoice.dispute_open = 1` |
| 7 | `PROMISE_TO_PAY_ACTIVE` | Active PTP with `kept IS NULL AND due_at >= now` |
| 8 | `PAID` | `risk_item.state = 'RECOVERED'` |
| 9 | `MAX_ATTEMPTS_REACHED` | `COUNT(communications WHERE risk_item_id = ?) >= 4` |

#### 4 Compliance Rails
| Rail | Rule | Window |
|---|---|---|
| Quiet Hours Voice | RBI Fair Practices Code | 08:00–19:00 local time |
| Quiet Hours Commercial | TRAI Commercial Comms | 08:00–21:00 local time |
| TRAI DLT Template | SMS must have registered template | `dlt_templates.registered = 1` |
| Channel Consent | DPDP / consent_* flags | Per-channel consent check |
| RBI e-Mandate | 24h pre-debit notice | `(now - last_pre_debit_notice_at) >= 24h` |

**`getLocalHour(timestamp, timezone)`:** Uses `Intl.DateTimeFormat` with `hour12: false` to convert a Unix timestamp to the customer's local hour (0–23). This handles all four timezones in the dataset correctly.

**The Batch Engine (`runGateEngine`):**
When run as a script, evaluates every planned step through `gate()` and writes results to `gate_decisions`. Steps that fail the gate are marked `status = 'BLOCKED'` in `plan_steps`. Also generates `docs/COMPLIANCE.md` — the live regulatory documentation.

**Why the gate is a pure function taking a `Database`:** This makes it unit-testable (`bun test` calls `gate()` directly on the real database), callable from the batch engine, and callable from the execution runner — all three use cases without code duplication.

---

## 13. Mock Adapters — `adapters/`

**What they are:** Formatters that produce realistic communication payloads without making any real network calls.

### `adapters/types.ts`
Defines `AdapterMessageInput` (everything needed to format a message: customer name, phone, email, language, exposure, playbook, step number) and `AdapterMessageOutput` (the formatted payload + metadata).

### `adapters/payment_link.ts`
Generates a deterministic payment URL:
```
https://pay.recoup.in/r/{riskItemId}?amt={paise}&sig={hash}
```
The signature is a truncated SHA-256 of the risk item ID + amount — reproducible but not guessable.

### `adapters/email.ts`
Produces different email subjects and bodies based on playbook:
- `DUNNING_LADDER` Step 1: gentle reminder
- `DUNNING_LADDER` Step 2+: firm escalation
- `CARD_UPDATER`: update card details
- `PARTIAL_PAYMENT`: instalment plan offer
- `PROMISE_TO_PAY`: statement of account with payment confirmation request

### `adapters/sms.ts`
Produces TRAI-DLT-registered SMS payloads with:
- Correct template IDs (`dlt_sms_dunning_1`, `dlt_sms_upi_retry_1`, etc.)
- The TRAI entity ID `RECOUP_DLT_110001` stamped on every message
- 160-character-friendly body text

### `adapters/whatsapp.ts`
Produces WhatsApp Business API payloads with:
- Multilingual body (EN/HI/HINGLISH) — Devnagari script for Hindi
- CTA buttons (`{type: "URL", text: "Pay Now via UPI", url: link}`)
- Cart recovery special case

### `adapters/voice.ts`
Produces a full call transcript with speaker turns:
```json
[
  {"speaker": "AI_AGENT", "text": "Namaste Rahul ji! Main Recoup support desk se bol raha hoon..."},
  {"speaker": "CUSTOMER", "text": "Haan, mera card sayad block ho gaya tha..."},
  {"speaker": "AI_AGENT", "text": "Koi baat nahi ji! Maine aapke WhatsApp pe ek instant UPI link bhej diya hai..."}
]
```
The Hinglish script is written phonetically to be readable by a text-to-speech model in production.

### `adapters/gateway.ts`
For `SMART_RETRY` playbook — produces a gateway charge attempt payload. Uses `Math.random()` for the charge ID (noted as a bug in the code review: should use the seeded RNG or a counter).

### `adapters/index.ts`
Re-exports all adapters and provides the `dispatchMockAdapter()` router function that selects the right formatter based on the channel.

**Why mock adapters return payloads instead of making HTTP calls:** This is explicitly noted in `HONESTY.md`. The payloads are production-quality — they use the exact JSON structure expected by WhatsApp Cloud API, Gupshup SMS, etc. In production, the only change would be replacing the `return { payload: ... }` with an HTTP POST to the real API.

---

## 14. Engine 5 — Execution & Outcome Resolver — `engines/execute.ts`

**What it is:** The most critical engine. It does two distinct things in a single 648-line file:
1. **Executes** the planned communication ladder through `gate()` and the mock adapters
2. **Resolves outcomes** by reading ground truth (as the sole authorized reader) and simulating whether each intervention succeeded

**Why these two things are together:** The outcome resolver must see the communications as they execute, so it can apply mid-ladder cancellation immediately when a customer pays. Separating them would require complex state-passing.

### Part 1: Execution
For each risk item:
1. Fetch its plan steps ordered by `step_no`
2. For each step, call `gate()` — if blocked, mark step `BLOCKED` and skip
3. Select the right adapter based on `step.channel`
4. Format the payload
5. Insert into `communications` table with `status = 'SENT'`

### Part 2: Outcome Resolution (Ground Truth Reading)
**This is the only place in the entire codebase that reads `ground_truth` and `ground_truth_events`.**

At the start, the engine loads both tables entirely into memory Maps:
```typescript
const gtCustMap = new Map<string, GroundTruthCustomer>();
const gtEventMap = new Map<string, GroundTruthEvent>();
```

For each communication sent, it consults the ground truth to decide whether the customer recovered:
```
effectiveBps = basePropensity * 0.4 + channelAffinity * 0.3 + playbookBoost * 0.3
touchRecovered = rng.bool(effectiveBps)
```

If `touchRecovered = true`:
- Insert a `recoveries` row
- Mark `risk_item.state = 'RECOVERED'`
- **Immediately cancel all remaining steps** (mid-ladder payment cancellation)
- Write an audit event `MID_LADDER_CANCELLED`

### Holdout Resolution
For holdout cohort items, no communications are sent. The outcome resolver checks `would_pay_anyway` from ground truth:
- If 1: insert an organic recovery at `first_seen_at + hours_until_unassisted × HOUR`
- If 0: mark as `CLOSED_LOST`

**Why this structure proves the measurement is honest:** Holdout customers never receive a communication, so their recovery rate is the pure "would have paid anyway" baseline. The treatment recovery rate minus the scaled holdout rate is the true incremental value.

**Output:** `communications`, `recoveries`, `promises_to_pay` tables populated; `out/execution_report.md` written.

---

## 15. Engine 6 — Audit Verifier — `engines/audit.ts`

**What it is:** The audit trail reader and verifier. Distinct from `src/audit.ts` (which writes events) — this engine reads the chain, recomputes all hashes, and verifies integrity.

**How verification works:**
```typescript
for each event in audit_events ORDER BY seq ASC:
  expectedHash = SHA256(event.prev_hash + "|" + canonical(event_payload))
  if expectedHash !== event.hash: CHAIN BROKEN at seq N
```

If every expected hash matches the stored hash, the chain is valid.

**Live tamper detection (`--tamper-test` flag):**
```typescript
// Temporarily mutates one row's decision field in memory
// Does NOT write to DB — the SQLite triggers would abort it
// Re-verifies from that point — correctly detects the mismatch
```
This demonstrates that the tamper detection catches single-byte mutations.

**Case timeline export:**
For three showcase cases (outage-suppressed, recovered, B2B PTP), the engine exports complete audit timelines to `out/audit_case_*.md` — showing every event from detection through recovery in chronological order.

**Output:** `out/audit_verification_report.md` + case timelines; also serves the `/api/verify` endpoint in the demo server.

---

## 16. Engine 7 — Measurement Harness — `engines/measure.ts`

**What it is:** The scientific proof layer. Computes the net incremental recovery and provides statistical validation via bootstrap confidence intervals.

**The Core Measurement (Stratum-Weighted Estimation):**

Standard A/B test comparison is biased when treatment and holdout exposure amounts differ by stratum. The harness uses **stratum-weighted scaling**:

```
For each stratum s (36 strata = 4 surfaces × 3 segments × 3 digital-literacy levels):
  holdout_rate_s = holdout_recovered_paise_s / holdout_exposure_s
  scaled_holdout_s = holdout_rate_s × treatment_exposure_s

scaled_holdout_baseline = Σ scaled_holdout_s
net_incremental = treatment_recovered - scaled_holdout_baseline
lift_pct = (net_incremental / scaled_holdout_baseline) × 100
```

This ensures the holdout baseline is calculated at the same exposure level as the treatment — apples-to-apples.

**Bootstrap Confidence Interval (1,000 samples):**
```
For i = 1..1000:
  resample = draw N cases with replacement from treatment+holdout pool
  compute lift on resample
  store lift_i

CI_95 = [percentile(2.5%, lifts), percentile(97.5%, lifts)]
```
The non-zero lower bound of the 95% CI proves the lift is statistically significant, not a sampling artifact.

**The Counterfactual Table:**
Three arms are presented:
1. **Pure Holdout** — measured from holdout cohort data
2. **Naive Dunning** — *modelled* at 18.5% (clearly disclosed, see `HONESTY.md`)
3. **Recoup Engine** — measured from treatment cohort data

**Output:** `out/measurement_report.md` + `out/benchmark_eval.json`.

---

## 17. Evaluation Script — `scripts/eval_diagnose.ts`

**What it is:** An offline accuracy benchmark for the diagnosis engine. Reads `ground_truth_events.true_root_cause` and compares against `diagnoses.root_cause` to compute accuracy.

**Why it's a script and not an engine:** It's the only script authorized to read ground truth *and* diagnoses simultaneously — because it's an evaluation tool, not a production engine. The design rule is that engines in the live pipeline can't read ground truth; evaluation scripts can.

**Output:** Accuracy % and a confusion matrix of true vs. predicted root causes.

---

## 18. The Demo Server — `server/index.ts`

**What it is:** A minimal Bun HTTP server that serves both the static web dashboard and live JSON APIs. 218 lines.

**Startup:** On startup, calls `runMeasurement(db)` once to cache the headline metrics. All subsequent requests to `/api/overview` use this cached result (measurement is deterministic given the same DB state).

**API Routes:**

| Route | Method | What It Returns |
|---|---|---|
| `/api/overview` | GET | Headline metrics, counterfactuals, chain status |
| `/api/cases` | GET | Filterable case list (surface, cohort, state, search) |
| `/api/case/:id` | GET | Complete case drilldown: timeline, comms, recovery |
| `/api/incident` | GET | The systemic incident replay details |
| `/api/verify` | POST | Runs `verifyChain(db)` live — returns chain status |
| `/api/tamper-test` | POST | Runs `testTamperProof(db)` — demonstrates detection |

**Static files:** `GET /` → `web/index.html`, `GET /styles.css` → `web/styles.css`, `GET /app.js` → `web/app.js`

**Why no framework:** Bun's `Bun.serve()` is a few lines of code for a simple JSON API server. Adding Express or Hono would require an npm install for no benefit at this scale.

---

## 19. The Dashboard — `web/`

**What it is:** A single-page executive dashboard built in vanilla HTML/CSS/JS. No React, no Vue, no build step.

### `web/index.html`
Structure:
- **Header bar:** Recoup logo, live audit chain event count (updated from API on load), pipeline status badge
- **Metric cards:** Incremental ₹, Treatment Recovered, 95% CI, Contacts Suppressed
- **Filter bar:** Surface (A/B/C/D), Cohort (Treatment/Holdout), State (Recovered/Lost/etc.), search
- **Cases table:** Paginated list of all 1,314 risk items
- **Case drilldown drawer:** 3-tab modal (Summary → Diagnosis+EV → Comms+Recovery)
- **Verify/Tamper buttons:** Live hash chain verification with visual feedback
- **Outage replay panel:** The HDFC incident summary with z-score display

### `web/styles.css`
Dark-mode premium design:
- HSL-based color palette (deep indigo background, cyan/emerald accents)
- Glass-morphism card effect (`backdrop-filter: blur()`)
- CSS custom properties (`--bg-primary`, `--accent-emerald`, etc.)
- Smooth transitions and hover effects
- Responsive grid layout

### `web/app.js`
Client logic:
- `loadOverview()` — fetches `/api/overview` and updates all metric cards; also updates `headerEventCount` from the live API (overwriting the HTML placeholder)
- `loadCases()` — fetches `/api/cases` with filter params, calls `renderCasesTable()`
- `openCaseDrawer(id)` — fetches `/api/case/:id`, renders 3-tab drilldown
- `verifyChain()` — POST `/api/verify`, shows spinner then green/red result
- `tamperTest()` — POST `/api/tamper-test`, shows detected tamper sequence

---

## 20. Test Suite — `test/gate.test.ts`

**What it is:** 11 unit tests covering all 9 stopping rules plus the two quiet-hours compliance rails.

**How they work:** Each test creates a controlled database condition and calls `gate()` directly:

```typescript
// Example test for MAX_ATTEMPTS_REACHED:
// Insert 4 fake communications for a test risk item
for (let i = 1; i <= 4; i++) {
  db.query(`INSERT INTO communications (...) VALUES (...)`).run(...)
}
const dec = gate(db, { riskItemId: testRiskId, ... })
expect(dec.allowed).toBe(false)
expect(dec.reasonCode).toBe("MAX_ATTEMPTS_REACHED")
// Cleanup
db.query(`DELETE FROM communications WHERE risk_item_id = ?`).run(testRiskId)
```

**Why tests use the real database:** The gate function reads customer, risk item, invoice, and PTP data from the database. Mocking the DB would require substantial setup and reduce confidence. Using the real seeded database means tests exercise real data relationships.

**Test coverage:**
- `QUIET_HOURS_VOICE` — 03:00 IST blocked, 14:00 IST allowed
- `QUIET_HOURS_COMMERCIAL` — 23:30 IST blocked
- `SYSTEMIC_INCIDENT` — item with `incident_id != null`
- `FRAUD_OR_BANKRUPTCY_FLAG` — customer with `fraud_flag = 1`
- `OPTED_OUT` — customer with `opted_out = 1`
- `DISPUTE_OPEN` — invoice with `dispute_open = 1`
- `PROMISE_TO_PAY_ACTIVE` — active PTP inserted, then cleaned up
- `PAID` — risk item in `RECOVERED` state
- `MAX_ATTEMPTS_REACHED` — 4 communications inserted
- `HUMAN_TAKEOVER` — plan with `HUMAN_ESCALATION` playbook
- `NEGATIVE_EV` — plan with `skipped=1, skip_reason='NEGATIVE_EV'`

**Run:** `bun test` — all 11 pass in ~183ms.

---

## 21. Configuration Files

### `package.json`
```json
{
  "scripts": {
    "seed":       "bun run scripts/seed.ts",
    "seed:verify":"bun run scripts/seed.ts --verify-repro",
    "detect":     "bun run engines/detect.ts",
    "diagnose":   "bun run engines/diagnose.ts",
    "policy":     "bun run engines/policy.ts",
    "gate":       "bun run engines/gate.ts",
    "execute":    "bun run engines/execute.ts",
    "verify":     "bun run engines/audit.ts --verify",
    "measure":    "bun run engines/measure.ts",
    "demo":       "bun run server/index.ts"
  }
}
```
`devDependencies` contains only `@types/bun` — no runtime npm packages. Everything is built on Bun's standard library.

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts", "engines/**/*.ts"]
}
```
`noUncheckedIndexedAccess: true` means `arr[0]` returns `T | undefined` — forcing explicit null checks on every array access. This catches the entire class of "undefined is not a function" bugs at compile time. Note: `test/`, `adapters/`, and `playbooks/` were originally missing from `include` (a bug caught in code review).

### `.gitignore`
```
node_modules/
*.log
*.db-wal
*.db-shm
.DS_Store
data/*.db
```
The SQLite database binary is gitignored (judges regenerate it with `bun run seed`). The `docs/` and `out/` directories are **committed** — hand-authored docs and generated reports travel with the repo.

---

## 22. Documentation Layer — `docs/`

### `docs/HONESTY.md`
The most important documentation file. Discloses:
1. What is simulated vs. real (gateway calls, customer data, outcome resolution)
2. The ground truth isolation rule
3. The naive dunning baseline is a **modelled 18.5% estimate**, not a measured arm
4. Why the audit event count varies across runs (append-only ledger)
5. What would change in a production deployment

### `docs/COMPLIANCE.md`
Auto-generated by `gate.ts` on every run. Contains the full regulatory framework — RBI Fair Practices Code, TRAI Commercial Comms, RBI e-mandate, DPDP — and the fired counts for all 9 stopping rules. This is always up-to-date with the latest run.

### `docs/DEMO_GUIDE.md`
A 5-moment, click-by-click walkthrough for the 3-minute live demo:
- Moment 1: Headline number (0:00–0:45)
- Moment 2: 4 Surfaces (0:45–1:15)
- Moment 3: Outage Simulator (1:15–1:50)
- Moment 4: 1-Click Case Drilldown (1:50–2:30)
- Moment 5: Hash Chain Verification (2:30–3:00)

### `docs/PITCH_SCRIPT.md`
Word-for-word stage script for 3 minutes. The language is calibrated for a fintech executive audience: no jargon beyond what's explained in context.

### `docs/STATE.md`
Step-by-step engineering tracker. Shows which of the 10 PROJECT_PLAN steps are complete and the verification results at each step.

### `docs/DATA_DICTIONARY.md`
Complete field-by-field documentation of every database table, enum value, and decline code.

---

## 23. Complete Data Flow: Seed → Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  bun run seed                                                        │
│  scripts/seed.ts                                                     │
│  ↓ Creates 1,200 customers, 13,626 payment attempts, 1,314 events   │
│  ↓ Injects 6h HDFC outage (88 failures, z=-7.14)                   │
│  ↓ Hides ground_truth (propensity, would_pay_anyway)                │
│  → data/recovery.db (3 audit events)                                │
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run detect                                                      │
│  engines/detect.ts                                                   │
│  ↓ Sliding-window z-score: detects HDFC outage → incidents row      │
│  ↓ Creates 1,314 risk_items (471A + 380B + 186C + 277D)            │
│  ↓ Stratified holdout: 1,117 TREATMENT / 197 HOLDOUT               │
│  → audit events, out/detection_report.md                            │
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run diagnose                                                    │
│  engines/diagnose.ts                                                 │
│  ↓ 21 items → SYSTEMIC_GATEWAY_OUTAGE (is_systemic=1)              │
│  ↓ 277 items → LLM-style regex on B2B email threads                │
│  ↓ 1,016 items → deterministic decline-code mapping                │
│  → diagnoses table, out/diagnoses_report.md                         │
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run policy                                                      │
│  engines/policy.ts + playbooks/                                      │
│  ↓ argmax EV across 11 playbooks for each of 1,314 risk items       │
│  ↓ 1,281 active plans + 33 skipped (EV≤0 / systemic / fraud)       │
│  ↓ 2,578 plan_steps generated (avg 2.0 steps per active case)       │
│  → intervention_plans, plan_steps, out/policy_rationale.md          │
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run gate                                                        │
│  engines/gate.ts                                                     │
│  ↓ 2,611 evaluations (2,578 steps + 33 skipped plans)               │
│  ↓ 682 BLOCKED: OPTED_OUT(129), DISPUTE_OPEN(52), SYSTEMIC(21)...  │
│  ↓ 1,929 ALLOWED                                                     │
│  → gate_decisions, docs/COMPLIANCE.md, out/suppression_report.md   │
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run execute                                                     │
│  engines/execute.ts                                                  │
│  ↓ For each risk item: gate() → adapter format → communications row  │
│  ↓ OUTCOME RESOLVER (only file that reads ground_truth):            │
│    - Treatment: P(recover) × exposure → recoveries row              │
│    - Holdout: would_pay_anyway → organic recoveries row             │
│  ↓ 1,340 comms sent; 377 mid-ladder steps cancelled                 │
│  ↓ 538 treatment recovered (₹10.04 Cr), 65 holdout (₹13.5L)        │
│  → communications, recoveries, promises_to_pay, out/execution_report│
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run verify                                                      │
│  engines/audit.ts --verify                                           │
│  ↓ Recomputes SHA-256 chain from genesis → seq 472                  │
│  ↓ Exports 3 case timelines (outage / recovered / B2B PTP)          │
│  → CHAIN VALID, out/audit_verification_report.md                    │
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run measure                                                     │
│  engines/measure.ts                                                  │
│  ↓ Stratum-weighted holdout scaling across 36 strata                │
│  ↓ Net incremental: ₹9,26,95,083.62 (+1,207.6% lift)               │
│  ↓ 1,000-sample bootstrap → CI [₹6.69Cr, ₹12.14Cr]                │
│  → out/measurement_report.md, out/benchmark_eval.json               │
└─────────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│  bun run demo                                                        │
│  server/index.ts → http://localhost:3000                             │
│  ↓ Serves web/index.html + live JSON APIs from data/recovery.db     │
│  ↓ /api/overview: headline numbers, chain status                    │
│  ↓ /api/cases: filterable 1,314-row case table                      │
│  ↓ /api/case/:id: 3-tab drilldown (summary/diagnosis/comms)         │
│  ↓ /api/verify: live SHA-256 chain verification                     │
│  ↓ /api/tamper-test: live tamper detection proof                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 24. Key Design Decisions & Why

### Decision 1: Integer Paise Everywhere
**The rule:** All monetary values are stored and computed as integer paise. `assertPaise()` throws on any non-integer.
**Why:** Floating-point arithmetic is non-associative: `0.1 + 0.2 ≠ 0.3` in IEEE 754. A payment system that uses floats for money will have cent-level discrepancies that compound into material errors. India's Unified Payments Interface (UPI) and RBI guidelines both mandate paise-level precision. The `BigInt` risk score calculation prevents integer overflow on `p_loss_bps × exposure_paise × urgency_bps`.

### Decision 2: The Randomized Holdout
**The rule:** 15% of risk items receive zero intervention.
**Why:** Without a holdout, it's impossible to distinguish "Recoup recovered ₹10 Cr" from "₹4 Cr of those customers would have paid anyway." The holdout makes the measurement counterfactually honest. The 15% split was chosen to be large enough for statistical power while keeping the treatment arm large enough for meaningful lift measurement.

### Decision 3: Strict Ground Truth Isolation
**The rule:** `ground_truth` and `ground_truth_events` are readable only by `engines/execute.ts`.
**Why:** If the diagnosis engine could read ground truth, it would know the "answer" before making a prediction — inflating its accuracy score. If the policy engine could read it, it would select playbooks based on hidden propensity rather than observable signals — making the system a prediction oracle rather than an autonomous agent.

### Decision 4: The Universal `gate()` Function
**The rule:** Every proposed communication must call `gate(db, input)` regardless of which engine is calling.
**Why:** A compliance error in a financial system can result in regulatory fines (TRAI can impose penalties for DND violations), customer complaints, and reputational damage. By making the gate non-bypassable, the architecture guarantees compliance even as new engines and playbooks are added. There is no "fast path" that skips the gate.

### Decision 5: Append-Only Audit at the Database Layer
**The rule:** SQLite triggers `BEFORE UPDATE` and `BEFORE DELETE` on `audit_events` raise `RAISE(ABORT, ...)`.
**Why:** Application-level audit enforcement can be bypassed by a developer who knows the codebase. Database-level triggers are enforced by the SQLite engine itself — even a direct SQLite client `UPDATE` statement will be aborted. This is why the hash chain verification is meaningful: an attacker cannot quietly update a past row.

### Decision 6: Seeded PRNG for All Randomness
**The rule:** `Rng(seed)` using xorshift32. `Math.random()` is only used in two places (gate ID and gateway charge ID — both identified as bugs in the code review).
**Why:** Reproducibility is a core feature. Judges need to be able to run `bun run seed` and get identical results. Scientists reviewing the methodology need to be able to trace exactly which customers ended up in holdout and why. Randomness from a known seed is reproducible randomness.

### Decision 7: Simulation Honesty over Impressiveness
**The rule:** Document every assumption, label every modelled estimate.
**Why:** A hackathon project that overstates its results is worse than one that accurately represents a simulation. The `HONESTY.md` file explicitly distinguishes:
- What is real production-grade code (the engines, the audit, the statistics)
- What is simulated (customer identities, payment outcomes)
- What is modelled vs. measured (naive dunning baseline)

This intellectual honesty is itself a signal of engineering maturity.

---

*This document was generated from a complete read of all 40+ source files in the Recoup project. Every claim about code behavior references the actual source.*
