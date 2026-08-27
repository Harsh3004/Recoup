# Recoup — Honesty & Architecture Disclosure

This document outlines the design boundary between the deterministic simulated sandbox and a live production deployment of Recoup. It also documents every modelled assumption that appears alongside measured results.

---

## 1. What is Simulated vs What is Real

| Component | In This Implementation (Hackathon Sandbox) | In Production Deployment |
|---|---|---|
| **Domain Model & Economy** | 1,200 synthetic customers across B2C, SMB, and Enterprise seeded with realistic Indian payment failure distributions. | Real merchant transaction stream, subscription billing database, and ERP invoices. |
| **Gateway & Communication** | High-fidelity mock adapters generating actual formatted payloads (JSON, TRAI DLT template text, WhatsApp CTA button structures, bilingual Hindi/Hinglish voice transcripts). | Live Razorpay / Cashfree APIs, Gupshup / Karix SMS gateways, Meta WhatsApp Business Cloud API, Exotel / Sarvam Voice APIs. |
| **Systemic Incident** | Injected 6-hour degradation on `Razorpay × HDFC` (z = -7.14, 88 failures / 120 attempts). | Live real-time gateway health monitoring via sliding-window anomaly detection and bank status webhooks. |
| **Outcome Resolution & Propensity** | Deterministic latent ground truth table (`ground_truth` and `ground_truth_events`) storing hidden customer payment propensities and unassisted resolution flags. | Real-world customer payment events received via webhook notifications (`payment.captured`, `invoice.paid`). |
| **B2B Email Thread Classifier** | **Regex / keyword pattern matching** on seeded `email_thread` text (e.g., `/GRN\|delivery challan/i`). Schema field `llm_used = true` marks where an LLM would be called in production. **No LLM API call is made.** Model version is `recoup-keyword-classifier-v1`. | LLM inference (e.g., GPT-4o / Claude 3.5 Sonnet) on real AP email threads, dispute notes, and ERP exception logs, returning structured `{root_cause, confidence, evidence[]}`. |
| **Engines & Logic** | **100% Real, Production-Grade TypeScript Code**: Signal extraction, anomaly detection, diagnosis, EV maximization, 9 stopping rules, quiet hours timezone calculation, SHA-256 hash chaining, stratum-weighted lift estimation, and bootstrap CI. | Exactly the same engine code running in production worker services. |
| **Audit Ledger** | **100% Real SQLite Append-Only Database**: With SHA-256 hash chaining and database-level triggers preventing any UPDATE or DELETE operations. | PostgreSQL / Amazon QLDB / ClickHouse append-only ledger with continuous hash verification. |

---

## 2. The Inviolable Ground Truth Isolation Rule

To guarantee that measurement is **scientifically honest** rather than theatrical:
1. The `ground_truth` and `ground_truth_events` tables are **strictly isolated**.
2. **Zero read access** by Detection, Diagnosis, Policy, or Compliance Gate engines.
3. Only the **Step 6 Outcome Resolver** and the offline benchmark evaluation script read ground truth to resolve actual payment occurrences.
4. All measurement is computed against a **randomized 15% holdout control group** across 36 strata.

---

## 3. Modelled Assumptions in the Counterfactual Comparison

The README and measurement report show three comparison arms:

| Arm | Type | Notes |
|---|---|---|
| **Pure Holdout Control** | **Measured from data** | Actual organic recovery from the 15% control cohort. Holdout customers receive zero outbound contact; recovery comes solely from customers who would have paid anyway. |
| **Recoup Autonomous Engine** | **Measured from data** | Actual recovery from the 85% treatment cohort, resolved by the outcome resolver reading `ground_truth_events`. |
| **Naive 3-Email Dunning** | **Modelled / assumed — not a third cohort** | This is an industry-literature estimate, **not a separately run experiment**. The calculation (`engines/measure.ts`, `naiveRecoveredPaise = totalTreatmentExposure × 0.185`) uses a hardcoded 18.5% recovery rate based on typical generic dunning campaign benchmarks for India B2C / SMB email campaigns. The channel cost (3 emails @ ₹0.20 each) is similarly modelled. This arm exists to give judges context for what a simpler system would have achieved; it is explicitly **not** measured from a third experimental arm in the data. |

> **Why include it at all?** Because presenting only Recoup vs. zero-contact holdout would make the lift appear larger than it is in a "replace an existing dunning tool" business context. The naive baseline makes the comparison more realistic and honest, not less — as long as its modelled nature is clearly disclosed. Which it now is, here.

---

## 4. Audit Event Count

A single clean pipeline run produces **574 audit events** (increased from 472 in the earlier version because the corrected outcome resolver now emits `ORGANIC_ACCELERATED` audit events for mid-ladder cancellations, improving the resolution audit trail). The count will be higher if the pipeline is re-run without reseeding, because the audit ledger is correctly append-only (immutable by design). Always reseed from `bun run seed` for a reproducible single-pass count.

---

## 5. Outcome Resolution Model — Corrected Architecture

The outcome resolver (`engines/execute.ts`, the sole reader of `ground_truth` and `ground_truth_events`) uses a **shared latent ground truth model** where both treatment and holdout arms are governed by the same underlying reality via `would_pay_anyway`.

### Organic Payers (`would_pay_anyway = 1`)
These customers would have paid regardless of Recoup's intervention. In treatment:
- They recover on the **first contact** (accelerated timeline only).
- The economic value is **time-value acceleration**, not incremental revenue.
- The stratum-weighted holdout scaling in `measure.ts` correctly subtracts this organic share from the treatment total, leaving only genuine incremental recovery.

### Non-Organic Payers (`would_pay_anyway = 0`)
These are genuinely convertible customers. Conversion probability is:
```
rawBps = propensity × 0.3 + channelAffinity × 0.4 + playbookSignal × 0.3
effectiveBps = min(2200, rawBps × fatigueDecay)
```
- **22% hard cap** per touch: keeps 4-touch cumulative recovery in a realistic 50–65% range for non-organic cases.
- **Fatigue decay** (`0.65^overTolerance`) applies after `max_tolerable_contacts` contacts (from ground truth). Over-contacting **destroys** conversion probability — this makes every stopping rule economically valuable, not just a regulatory cost. The agent that stops early now makes more money than the agent that spams.
- **`playbookSignal`** is intentionally moderate (1000–1500 bps range) — the agent's "intelligence" shows as routing and timing decisions, not as hardcoded score inflation in the reward table.

### Why this produces honest lift numbers
Organic payers in treatment are subtracted by the holdout baseline (`measure.ts`). Non-organic payers convert at bounded realistic rates. The net incremental is the genuine value created by Recoup's root-cause routing, playbook selection, and compliance-aware timing — not an artifact of the measurement design.

---

## 6. What Would Change in Production

1. **Authentication & Multi-Tenancy**:
   - Add tenant isolation (`merchant_id` partitioning) and RBAC for merchant dashboard access.
2. **Real-Time Webhook Ingestion**:
   - Ingest `payment.failed`, `subscription.halted`, `order.abandoned`, and `invoice.overdue` webhooks from Razorpay with idempotency deduplication.
3. **Outbound Provider Adapters**:
   - Swap mock dispatchers for authenticated REST clients calling WhatsApp Cloud API, Gupshup DLT-registered SMS, AWS SES, and Twilio/Sarvam Voice bots.
4. **Active Learning & Parameter Calibration**:
   - Update $P(\text{recover} \mid \text{cause, channel, segment})$ dynamically using live Bayesian updates based on observed campaign conversion.
5. **Naive Dunning Baseline (Production)**:
   - Replace the modelled 18.5% estimate with a true A/B measured arm from live merchant data, isolating a third cohort that receives only generic email dunning with no root-cause awareness.
