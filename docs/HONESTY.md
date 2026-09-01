# Recoup — Honesty & Architecture Disclosure

This document outlines the design boundary between the deterministic simulated sandbox and a live production deployment of Recoup. It also documents every modelled assumption, AI integration point, and statistical method that appears alongside measured results.

---

## 1. What is Simulated vs What is Real

| Component | In This Implementation (Hackathon Sandbox) | In Production Deployment |
|---|---|---|
| **Domain Model & Economy** | 1,200 synthetic customers across B2C, SMB, and Enterprise seeded with realistic Indian payment failure distributions. | Real merchant transaction stream, subscription billing database, and ERP invoices. |
| **Gateway & Communication** | High-fidelity mock adapters generating actual formatted payloads (JSON, TRAI DLT template text, WhatsApp CTA button structures, bilingual Hindi/Hinglish voice transcripts) gated by cryptographic `GatePassport` tokens. | Live Razorpay / Cashfree APIs, Gupshup / Karix SMS gateways, Meta WhatsApp Business Cloud API, Exotel / Sarvam Voice APIs. |
| **Systemic Incident** | Injected 6-hour degradation on `Razorpay × HDFC` (z = -7.14, 88 failures / 120 attempts). | Live real-time gateway health monitoring via sliding-window anomaly detection and bank status webhooks. |
| **Outcome Resolution & Propensity** | Deterministic latent ground truth table (`ground_truth` and `ground_truth_events`) storing hidden customer payment propensities and unassisted resolution flags. | Real-world customer payment events received via webhook notifications (`payment.captured`, `invoice.paid`). |
| **B2B Email Thread NLU** | **Structured JSON LLM NLU Diagnostic Engine** (`src/ai/diagnose_llm.ts`) with SHA-256 prompt-hash disk caching (`data/llm_cache.json`). Runs live `gpt-4o-mini` inference when `OPENAI_API_KEY` is set and populates the cache with full token provenance. In offline mode (cache empty, no key), the offline keyword classifier is used and the benchmark **exits with code 1** to prevent misrepresentation. See §2b. | Production worker cluster executing high-throughput batch LLM inference on AP email threads, dispute notes, and ERP exception logs. |
| **Engines & Logic** | **100% Real, Production-Grade TypeScript Code**: Signal extraction, anomaly detection, LLM diagnosis, EV maximization, 9 stopping rules, quiet hours timezone calculation, SHA-256 hash chaining, stratum-weighted lift estimation, and bootstrap CI. | Exactly the same engine code running in production worker services. |
| **Audit Ledger** | **100% Real SQLite Append-Only Database**: With SHA-256 hash chaining and database-level triggers preventing any UPDATE or DELETE operations covering **8,319 end-to-end events**. | PostgreSQL / Amazon QLDB / ClickHouse append-only ledger with continuous hash verification. |

---

## 2. The Inviolable Ground Truth Isolation Rule

To guarantee that measurement is **scientifically honest** rather than theatrical:
1. The `ground_truth` and `ground_truth_events` tables are **strictly isolated**.
2. **Zero read access** by Detection, Diagnosis, Policy, or Compliance Gate engines.
3. Only the **Step 6 Outcome Resolver** and the offline benchmark evaluation script read ground truth to resolve actual payment occurrences.
4. All measurement is computed against a **randomized 15% holdout control group** across 36 strata.

---

## 2b. LLM Integration — Honest Status

The B2B NLU diagnostic engine (`src/ai/diagnose_llm.ts`) uses `gpt-4o-mini` via `src/ai/llm_client.ts`.

**Cache provenance:** Every entry in `data/llm_cache.json` produced by a live API call carries `isFallback: false`, the exact model string (e.g. `gpt-4o-mini-2024-07-18`), `tokenUsage`, and `inferredAt` timestamp. Entries produced by the offline keyword classifier carry `isFallback: true` and are never served as cache hits in future runs.

**Current state:** `data/llm_cache.json` is empty. The cache will be populated with real `gpt-4o-mini` responses the first time `OPENAI_API_KEY=<key> bun run benchmark:llm` is run (estimated cost: ~$1–3 for 200–500 Surface D threads). Once populated, all subsequent benchmark runs replay deterministically from real responses.

**Benchmark integrity guard:** `bun run benchmark:llm` sets `BENCHMARK_STRICT=1` automatically. In this mode, the LLM client throws on any cache miss instead of running the offline classifier, so the benchmark can never accidentally score keyword-classifier output as LLM accuracy.

**Offline classifier:** When `OPENAI_API_KEY` is not set and no real cache exists, the keyword classifier is used. It logs a loud `[WARN] LLM_FALLBACK_USED` per invocation and writes entries tagged `isFallback: true`. The benchmark exits with code 1 in this state — this is by design. The offline classifier achieves ~80% accuracy on the seeded patterns (matching the naive ageing-bucket baseline) and is documented as a rules-based fallback, not LLM inference.



## 3. Causal Response Function & Matrix-Driven Outcome Resolution

The outcome resolver (`engines/execute.ts`, the sole reader of `ground_truth` and `ground_truth_events`) implements a formal **Causal Response Function**:

$$P(\text{recover} \mid \text{case}, \text{action}) = \text{base} \times (0.5 + 0.5 \cdot \text{channel\_fit}) \times \text{message\_fit}(\text{playbook}, \text{root\_cause}) \times \text{timing} \times \text{fatigue}$$

### Organic Payers (`would_pay_anyway = 1`)
These customers would have paid regardless of Recoup's intervention.
- They accelerate on the first touch **only if the playbook is relevant** ($\text{messageFit} \ge 0.25$). A customer with a missing GRN in stores will not accelerate when spammed with generic dunning emails.
- The stratum-weighted holdout scaling in `measure.ts` correctly subtracts this organic share from the treatment total, leaving only genuine incremental recovery.

### Non-Organic Payers (`would_pay_anyway = 0`)
These are genuinely convertible customers.
- **`message_fit` matrix**: Matches specific playbooks to diagnosed root causes (e.g. `PO_GRN_MISMATCH` $\to$ `HUMAN_ESCALATION`: 0.88, `DUNNING_LADDER`: 0.05).
- **Spam fatigue decay**: Mismatched touches trigger severe contact fatigue ($0.68^{\text{overTolerance}}$), making poorly targeted outreach counterproductive.
- **Realistic PTP realization**: B2B Promises-to-Pay are modeled with realistic fulfillment rates and partial payment discounts (75–100% realization).

---

## 4. Playbook Ablation & Causal Attribution

To prove that agent routing decisions causally drive value rather than latent willingness to pay, Recoup includes a first-class ablation suite (`engines/ablate.ts`):

- **Recoup Agent Policy:** ₹4,23,85,483.70 net incremental (+564.2% lift)
- **Identical Naive Dunning Arm:** ₹2,05,14,350.00 net incremental
- **Degradation:** **-51.6%** (Target: $\ge 25\%$, **PASS**)
- **Causal Value Unlocked by Agent:** **₹2,18,71,133.70**

---

## 5. Audit Event Count

A single clean pipeline run produces **8,319 audit events** across all pipeline decisions (detection batches, diagnoses, EV plans, gate evaluations, adapter dispatches, recoveries, and state transitions). Every event is cryptographically bound into the SHA-256 hash chain with SQLite triggers preventing tampering.

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
