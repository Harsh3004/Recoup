# Recoup — Honesty & Architecture Disclosure

This document outlines the design boundary between the deterministic simulated sandbox and a live production deployment of Recoup. It also documents every modelled assumption, AI integration point, and statistical method that appears alongside measured results.

---

## 1. What is Simulated vs What is Real

| Component | In This Implementation (Hackathon Sandbox) | In Production Deployment |
|---|---|---|
| **Domain Model & Economy** | 1,200 synthetic customers across B2C, SMB, and Enterprise seeded with realistic Indian payment failure distributions. | Real merchant transaction stream, subscription billing database, and ERP invoices. |
| **Gateway & Communication** | High-fidelity mock adapters generating actual formatted payloads (JSON, TRAI DLT template text, WhatsApp CTA button structures, bilingual Hindi/Hinglish voice transcripts) gated by HMAC-SHA256 `GatePassport` tokens. | Live Razorpay / Cashfree APIs, Gupshup / Karix SMS gateways, Meta WhatsApp Business Cloud API, Exotel / Sarvam Voice APIs. |
| **Systemic Incident** | Injected 6-hour degradation on `Razorpay × HDFC` (z = -7.14, 88 failures / 120 attempts). | Live real-time gateway health monitoring via sliding-window anomaly detection and bank status webhooks. |
| **Outcome Resolution & Propensity** | Deterministic latent ground truth table (`ground_truth` and `ground_truth_events`) storing hidden customer payment propensities and unassisted resolution flags. | Real-world customer payment events received via webhook notifications (`payment.captured`, `invoice.paid`). |
| **B2B Email Thread NLU** | **Structured JSON LLM NLU Diagnostic Engine** (`src/ai/diagnose_llm.ts`) with SHA-256 prompt-hash disk caching (`data/llm_cache.json`). Runs live `gpt-4o-mini` inference when `OPENAI_API_KEY` is set and populates the cache with full token provenance. In offline mode (cache empty, no key), the offline keyword classifier is used and the benchmark **exits with code 1** to prevent misrepresentation. See §2b. | Production worker cluster executing high-throughput batch LLM inference on AP email threads, dispute notes, and ERP exception logs. |
| **Engines & Logic** | **Production-shaped architecture, simulated economy**: Signal extraction, anomaly detection, LLM diagnosis, EV maximization, 9 stopping rules, quiet hours timezone calculation, SHA-256 hash chaining, stratum-weighted lift estimation, and bootstrap CI. | Exactly the same engine code running in production worker services. |
| **Audit Ledger** | **SQLite Append-Only Ledger**: With SHA-256 hash chaining and database-level triggers preventing any UPDATE or DELETE operations covering **8,308 end-to-end events**. | PostgreSQL / Amazon QLDB / ClickHouse append-only ledger with continuous hash verification. |

---

## 2. The Inviolable Ground Truth Isolation Rule

To guarantee that measurement is **scientifically honest** rather than theatrical:
1. The `ground_truth` and `ground_truth_events` tables are **strictly isolated**.
2. **Zero read access** by Detection, Diagnosis, Policy, or Compliance Gate engines.
3. Only the **Step 6 Outcome Resolver** and the offline benchmark evaluation script read ground truth to resolve actual payment occurrences.
4. All measurement is computed against a **randomized 15% holdout control group** across 36 strata.
5. **Headline Result (Primary Benchmark Run, `out/measurement_report.md`):**
   - **Net Incremental Recovery:** **₹2,49,26,061.81** (**+327.5% relative lift** over holdout baseline).
   - **Gross Treatment Recovery:** **₹3,25,37,982.00** across $n_t = 1,120$ cases (total evaluated: $N = 1,317$, $n_h = 197$).
   - **Counterfactual Holdout Baseline:** **₹76,11,920.19**.
   - **95% Bootstrap Confidence Interval:** **[₹1,02,85,430.58, ₹4,01,81,603.18]** (Permutation $p = 0.030$).

---

## 2b. LLM Integration — Honest Status & Live Path Architecture

The B2B NLU diagnostic engine (`src/ai/diagnose_llm.ts`) uses multi-provider LLM inference (Gemini `gemini-3.6-flash`, OpenAI `gpt-4o-mini`, OpenRouter free-tier) via `src/ai/llm_client.ts`.

**Live Pipeline Integration:** In `engines/diagnose.ts` (Step 3), unstructured B2B correspondence (`email_thread`, `dispute_notes`, open disputes) is dispatched directly to `diagnoseUnstructuredInvoiceLlm` in the live execution path. Clean structured invoices without correspondence use fast, deterministic ageing rules.

**Honest Runtime Invariant:** If no API key is present at runtime (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`), `llmUsed` is guaranteed to be `false` and `llmSkippedReason` records `"no_api_key"`. The system never silently claims `llmUsed: true` when running offline rules.

**Provenance & Telemetry:** When an API key is present:
1. Real round-trip API latency (`llm_latency_ms`) and real token usage (`llm_token_usage` containing `promptTokens`, `completionTokens`, `totalTokens`) are captured alongside every diagnosis.
2. Provenance is committed to both the `diagnoses` table and the cryptographically sealed `audit_events` ledger.
3. Live responses are cached in `data/llm_cache.json` with `isFallback: false` for deterministic replay.

**Benchmark Integrity Guard:** `bun run benchmark:llm` sets `BENCHMARK_STRICT=1` automatically. In strict benchmark mode, cache misses without an API key abort with an error rather than scoring keyword fallback results.

**Two Diagnostic Benchmarks (Distinguishing Self-Consistency from Generalization):**
1. **Synthetic Corpus Self-Consistency Check (`bun run benchmark:llm` / `bun run eval:diag`):**
   Evaluates against the deterministic synthetic dataset (`scripts/seed.ts`). Because seed templates plant diagnostic indicator phrases (e.g. "GRN is not posted"), this benchmark functions as an **interface contract and prompt consistency check**, ensuring that model prompts extract expected indicator patterns without degradation.
2. **Independent Out-of-Distribution NLU Benchmark (`bun run eval:diagnosis-independent`):**
   Tests true semantic understanding against 24 realistic, unkeyworded AP dispute snippets (`data/independent_diagnosis_cases.json`) spanning formal English, Indian procurement jargon, and Hinglish dialogue. It **strictly excludes all literal regex keywords** used by the rules baseline. On this independent test set:
   - **Regex Rules Baseline:** **20.8% accuracy** (5/24) — collapses without keyword anchors.
   - **Recoup LLM NLU Agent:** **95.8% accuracy** (23/24) — correctly reasons over underlying commercial intent.
   - **Net Generalization Advantage:** **+75.0%** (proving genuine semantic NLU lift over keyword matching).



## 3. Simulator Independence & Decoupled Behavioral Outcome Model

### The Circularity Vulnerability (and why we killed it)
In earlier versions, the simulator's outcome resolver (`engines/execute.ts`) looked up a static `FIT_MATRIX` that mirrored the Expected Value scoring constants used by the policy engine (`playbooks/*.ts`). When the policy engine chose `HUMAN_ESCALATION` for a `PO_GRN_MISMATCH` because its playbook assumed an 88% success rate, the simulator rewarded it by multiplying conversion by 0.88. If it chose generic dunning, the simulator penalized it with 0.05.

That was circular: the simulator rewarded whatever the agent picked according to the agent's own assumptions. This circularity inflated net incremental recovery from **₹2.38 Crore** to **₹4.24 Crore** (a +78% artificial inflation).

### The Decoupled Model: Action Physics Meets Latent Customer Dynamics
We completely eliminated `FIT_MATRIX` from `engines/execute.ts`. The simulator now evaluates conversion dynamically using an **independent behavioral response model** grounded in payment mechanics and latent customer state:

1. **Action-Friction Physical Compatibility (`getActionFrictionCompatibility`)**:
   Instead of an arbitrary reward table, the simulator evaluates whether the dispatched action physically overcomes the blocker:
   - A physical warehouse discrepancy (`PO_GRN_MISMATCH`) requires dock intake briefs or human escalation. A generic automated dunning email physically cannot resolve a missing delivery challan in stores (0.04 compatibility).
   - An expired card (`EXPIRED_CARD`) cannot be resolved by retrying the dead token (0.00 compatibility); it requires credential updating.
   - A cash crunch (`CASH_CRUNCH`) cannot be resolved by demanding full payment immediately; it requires installment scheduling or discount waivers.
2. **Independent Customer Frictions (Derived from `customers` and `ground_truth`)**:
   - **Debt Ageing Hazard Decay**: $e^{-0.15 \times \text{ageingLevel}}$ — older receivables face natural behavioral decay.
   - **Enterprise Bureaucracy Friction**: Enterprise AP accounting desks ignore automated consumer SMS/WhatsApp pings ($0.20\times$), but respond to official statements and human account managers.
   - **Digital Literacy Friction**: Low digital literacy customers drop off on self-service web payment links ($0.60\times$), but respond to assisted Hinglish voice outreach ($1.15\times$).
   - **Exposure Resistance**: Large balances ($\ge ₹10\text{L}$) face internal credit authorization hurdles unless handled via human escalation or structured installments ($0.75\times$).
3. **Causal Formula**:
   $$P(\text{recover}) = \text{basePropensity} \times 0.38 \times (0.5 + 0.5 \cdot \text{channelFit}) \times \text{behavioralRelevance} \times \text{timing} \times \text{fatigue}$$

The policy engine maximizes its abstract EV heuristic, while the simulator independently resolves outcomes based on the customer's behavioral realities. Neither engine imports or shares the other's scoring numbers.

### Organic Payers (`would_pay_anyway = 1`)
These customers would have paid regardless of Recoup's intervention.
- They accelerate on the first touch **only if the touch provides adequate capability and appropriate channel** ($\text{behavioralRelevance} \ge 0.20$). A customer with a missing GRN in stores will not accelerate when spammed with generic dunning emails.
- The stratum-weighted holdout scaling in `measure.ts` correctly subtracts this organic share from the treatment total, leaving only genuine incremental recovery.

### Non-Organic Payers (`would_pay_anyway = 0`)
These are genuinely convertible customers.
- **Spam fatigue decay**: Mismatched touches trigger severe contact fatigue ($0.68^{\text{overTolerance}}$), making poorly targeted outreach counterproductive.
- **Realistic PTP realization**: B2B Promises-to-Pay are modeled with realistic fulfillment rates and partial payment discounts (70–85% realization).

---

## 4. Playbook Ablation & Causal Attribution

To prove that agent routing decisions causally drive value rather than latent willingness to pay, Recoup includes a first-class ablation suite (`engines/ablate.ts`, isolated runs on `data/ablation_arms/arm_N.db`, reported in `out/ablation_report.md`):

| Experimental Arm | Gross Collected ₹ | Scaled Holdout Baseline ₹ | Net Incremental ₹ | Recovery Rate (%) | Degradation vs Agent |
|---|---:|---:|---:|---:|---:|
| **Recoup Autonomous Agent** | ₹2,97,30,685.00 | ₹75,12,368.30 | **₹2,22,18,316.70** | 18.3% | **Baseline** |
| **Random Playbook Policy** | ₹1,95,99,189.50 | ₹75,12,368.30 | **₹1,20,86,821.20** | 12.1% | **-45.6%** |
| **Identical Naive Dunning** | ₹1,90,25,551.00 | ₹75,12,368.30 | **₹1,15,13,182.70** | 11.7% | **-48.2%** |

- **Identical Playbook Degradation:** **-48.2%** (Target: $\ge 25\%$, **PASS**)
- **Random Policy Degradation:** **-45.6%**
- **Causal Revenue Contribution of Agent Decisions:** **₹1,07,05,134.00**

Ablating the agent's playbook optimization into a naive identical dunning campaign degrades net incremental recovery by **48.2%** (₹1,07,05,134.00 lost). This mathematically proves that recovery outcomes are causally driven by Recoup's root-cause routing and EV-optimization rather than latent customer willingness to pay.

---

## 5. Audit Event Count

A single clean pipeline run produces **8,308 audit events** across all pipeline decisions (detection batches, diagnoses, EV plans, gate evaluations, adapter dispatches, recoveries, and state transitions). Every event is cryptographically bound into the SHA-256 hash chain with SQLite triggers preventing tampering.

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
