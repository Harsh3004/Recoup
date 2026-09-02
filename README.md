# Recoup — Autonomous Failed Payment Recovery & Compliance Engine

### ₹2.39 Cr recovered in a simulated economy of 1,200 merchants (+318.5% lift over 15% holdout baseline)

> **Simulation & Causal Attribution Notice:** All figures reported below reflect a deterministic benchmark simulation of 1,200 Indian businesses, 13,626 payment attempts, and ₹18.65 Crore in failed payment exposure across 4 transaction surfaces. Incremental recovery is measured against a strict 15% randomized holdout control with a fair, organic-inheriting ablation arm. No real payments were attempted or collected — see [`docs/HONESTY.md`](docs/HONESTY.md) for the full simulation boundary disclosure.

---

## 🏆 Benchmark Results

Across 1,200 simulated Indian businesses and ₹18.65 Crore in total failure exposure:

- **Net Incremental ₹ Recovered (R1):** **₹2,39,24,614.70** (**+318.5% lift** over the 15% control holdout baseline).
- **Gross Treatment Cash Collected:** **₹3,14,36,983.00** (recovered across 1,314 treatment cases).
- **Fair Causal Ablation Control:** **-48.2% degradation** when the agent's root-cause optimization is ablated into naive dunning inheriting natural organic resolution (Target: $\ge 25\%$, **PASS**).
- **Diagnostic NLU Evaluation (3-Way Benchmark):**
  - **LLM NLU Classifier (MiniMax M3 / Gemini):** **95.8%** (23/24) — *requires `OPENROUTER_API_KEY` or a warm cache; cold-clone aborts with `[FATAL]` to prevent silent mis-labelling. Run: `OPENROUTER_API_KEY=<key> bun run eval:diagnosis-independent`.*
  - **Fair Domain Rules Baseline (Expanded Synonyms):** **75.0%** (18/24) — *always reproducible without an API key.*
  - **Narrow Seed Keyword Baseline:** **20.8%** (5/24)
  - *Evaluated on 24 author-curated qualitative sanity check cases representing messy AP correspondence without keyword cheating.*
- **95% Bootstrap Confidence Interval:** **[₹88,46,303.17, ₹4,13,81,342.84]** (1,000 stratified resamples).
- **Sensitivity Band (±1 SE on Holdout Scaling):** **[₹2,12,86,609.52, ₹2,65,62,619.88]**.
- **Contacts Suppressed by Compliance Rails (R2/R3):** **682 actions blocked** (zero quiet hours breaches, zero DND violations, zero customer contacts during gateway outages).
- **Audit Ledger Integrity (R4):** **8,303 events** verified on an end-to-end SHA-256 hash chain protected by SQLite triggers (`bun run verify`).
- **Dynamic AI Model Switching:** UI settings console allows 1-click model switching (OpenRouter `minimax/minimax-m3:free`, Gemini 2.5 Flash, GPT-4o-mini, or Offline Rules).

---

## ⚡ Reproduce Everything in < 60 Seconds

```bash
# 1. Install dependencies (Bun v1.0+)
bun install

# 2. Deterministic seed verification (fixed seed 42)
bun run seed:verify

# 3. Run automated unit & security invariant tests (36/36 pass in ~400ms)
bun test

# 4. Run full end-to-end recovery pipeline (single clean pass)
bun run seed
bun run detect
bun run diagnose
bun run policy
bun run gate
bun run execute
bun run verify
bun run measure

# 5. Run fair causal ablation & diagnostic benchmarks
bun run ablate                        # Fair counterfactual policy ablation (-48.2% degradation)
bun run benchmark:llm                 # Seeded corpus interface contract self-consistency check
# LLM accuracy benchmark (requires API key or warm cache — aborts cleanly otherwise):
# OPENROUTER_API_KEY=<key> bun run eval:diagnosis-independent

# 6. Launch interactive executive demo dashboard with AI model settings
bun run demo
# Open http://localhost:3000 in your browser
```

---

## 📐 Architecture & Data Flow

![Recoup Pipeline Architecture](assets/pipeline-flowchart.jpg)

*The pipeline flows through six stages: (1) signal detection across four transaction surfaces with outage-aware anomaly detection, (2) LLM NLU diagnosis for the 277/1,314 Surface D cases with unstructured AP email threads (remaining 1,037 cases use deterministic domain rules — both paths contribute to the headline recovery figure), (3) EV-optimized playbook selection, (4) a centralized compliance gate enforcing quiet hours, TRAI DLT, RBI pre-debit notice, and the 9 stopping rules via HMAC-SHA256 GatePassport tokens, (5) mock-adapter execution (the only exported dispatch entry point in the codebase) with causal outcome resolution against a hidden ground truth, and (6) tamper-evident audit logging paired with stratified holdout measurement.*

> **Reading the measurement report honestly:** ~94% of the net incremental recovery comes from Surface D (B2B high-value invoices), where root-cause diagnosis (PO/GRN vs. cash crunch vs. approval queue) most sharply differentiates playbook selection. Surface A (subscriptions) shows a slightly **negative** incremental (-₹3.01L) — the agent underperforms the organic baseline there due to strict mandate friction. Surface B and C are modestly positive. The "all four surfaces, unified" pitch is architecturally accurate; economically, the B2B lift is the headline driver. Full breakdown: `out/measurement_report.md`.

> **Simulation disclosure:** All ₹ figures are properties of a simulated economy (synthetic customers, seeded PRNG outcomes, mock adapter dispatches). No real payments were attempted or collected. The lift is a property of the outcome resolution model — bounded, fatigued, and honestly calibrated — not external market validation. Full disclosure: `docs/HONESTY.md`.

---

## 🎯 The Four Scoring Requirements (R1 – R4)

| Requirement | Implementation & Location | Verification Output |
|---|---|---|
| **R1: Incremental ₹ Recovered** | [`engines/measure.ts`](engines/measure.ts)<br>Stratum-weighted estimation with small-strata empirical shrinkage & 1,000-sample bootstrap 95% CI. | **₹2,39,24,614.70 net incremental recovery**<br>95% CI: `[₹88.46 L – ₹4.14 Cr]` (`out/measurement_report.md`) |
| **R2: Strict Compliance Rails** | [`engines/gate.ts`](engines/gate.ts)<br>Choke point `gate()` minting HMAC-SHA256 `GatePassport` tokens (the only exported dispatch path) enforcing 9 stopping rules, TRAI DLT, and RBI 24h notice. | **682 actions blocked**<br>0 sends to opted-out contacts; 0 sends during outage (`out/suppression_report.md`) |
| **R3: Tone Ladder & Quiet Hours** | [`engines/gate.ts`](engines/gate.ts) + [`adapters/voice.ts`](adapters/voice.ts)<br>Strict timezone enforcement (08:00–19:00 for voice) and bilingual Hinglish scripts. | **Zero quiet hours violations**<br>29 touches blocked outside window; 11/11 gate tests pass · 36/36 suite total (`bun test`) |
| **R4: Tamper-Evident Audit Trail** | [`engines/audit.ts`](engines/audit.ts)<br>End-to-end SHA-256 hash chaining ($H_i = \operatorname{SHA-256}(H_{i-1} \parallel \operatorname{canonical}(P_i))$) with SQLite abort triggers. | **8,303 events verified against genesis**<br>Live tamper detection validated (`bun run verify`) |

---

## ⚖️ Counterfactual & Ablation Comparison

| Recovery Strategy | Gross Collected | Comms Cost | Net Realized Value | Lift vs Organic Holdout | Causal Degradation |
|---|---:|---:|---:|---:|---:|
| **Pure Holdout Control (Unaided Baseline)** | ₹75,12,368.30 | ₹0.00 | ₹75,12,368.30 | 0.0% | — |
| **Identical Naive Dunning Arm (Fair Control)** | ₹2,07,31,849.00 | ₹1,240.00 | ₹1,32,19,480.70 | +175.9% | **-48.2%** |
| **Random Applicable Playbook Arm** | ₹2,09,86,102.00 | ₹1,820.00 | ₹1,34,71,913.70 | +179.3% | **-47.1%** |
| **Recoup Autonomous Engine** | **₹3,14,36,983.00** | **₹2,085.00** | **₹2,39,24,614.70** | **+318.5%** | **Baseline (0.0%)** |

---

## ⚡ Live Rail: Razorpay Test-Mode Payment Links & Webhooks

To demonstrate real-world operational viability without compromising the reproducible 1,200-merchant benchmark, Recoup features a **scoped live rail** built on Razorpay's test-mode APIs:

### What Is Live vs. What Is Simulated

| Component | Status | Mechanism |
|---|---|---|
| **Payment Link Creation** | **LIVE** | Real REST calls to `POST https://api.razorpay.com/v1/payment_links` using `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`. Generates authentic `https://rzp.io/i/xxxxxx` checkout links. |
| **Hosted Checkout Experience** | **LIVE** | Real Razorpay hosted payment page. Supports test UPI, dummy cards, and simulated payment success/failure. |
| **Case Resolution via Webhook** | **LIVE** | `POST /webhooks/razorpay` verifies HMAC-SHA256 signatures (`x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET`), consumes `payment_link.paid`, closes the matching case (`state = 'RECOVERED'`), and cryptographically logs the recovery into the SHA-256 audit ledger. |
| **Case Provenance Flag** | **LIVE** | Cases resolved via webhooks are tagged `resolved_via: 'razorpay_live_webhook'` and display a glowing `⚡ LIVE RZP RECOVERED` badge in the UI. |
| **Batch Economy Simulation** | **SIMULATED** | The 1,200-merchant cohort, synthetic communications, and counterfactual holdout baseline remain simulated to enable reproducible, instant benchmarks without spamming test gateways. |

> **Graceful Fallback:** When Razorpay API credentials are not provided in `.env`, the engine seamlessly falls back to deterministic mock payment URLs (`https://rzp.io/i/rec_<id>_<hash>`), allowing all 36 unit tests and offline evaluations to run in milliseconds.

---

### Step-by-Step Testing in Razorpay Test Mode

1. **Configure Test Credentials in `.env`:**
   ```bash
   RAZORPAY_KEY_ID=rzp_test_yourKeyHere
   RAZORPAY_KEY_SECRET=yourSecretHere
   RAZORPAY_WEBHOOK_SECRET=yourWebhookSecretHere
   ```
2. **Start the Recoup Demo Server:**
   ```bash
   bun run demo
   # Server runs on http://localhost:3000
   ```
3. **Generate a Live Payment Link:**
   - In the dashboard, click any case row to open the drilldown drawer.
   - In the **⚡ Razorpay Test-Mode Payment Rail** card, click **⚡ Generate Razorpay Test Link**.
   - An authentic Razorpay link (`https://rzp.io/i/...`) will be minted and displayed.
4. **Complete Test Payment:**
   - Click **💳 Open Test Checkout ↗** to open Razorpay's hosted payment page.
   - Pay using Razorpay test credentials (e.g., Test Card `4111 1111 1111 1111`, expiry `12/30`, CVV `123`, OTP `123456`, or Test UPI).
5. **Verify Webhook Case Resolution:**
   - Point the [Razorpay Webhook Simulator](https://dashboard.razorpay.com/app/webhooks) to your webhook URL (`http://localhost:3000/webhooks/razorpay`), or expose via `ngrok http 3000`.
   - When the `payment_link.paid` event arrives, the case instantly updates to **`⚡ LIVE RZP RECOVERED`**.
   - Open the **Audit Ledger** tab to verify that the webhook payment was cryptographically chained into the immutable SHA-256 audit log.

---

## 🔍 In-Depth Technical Documents

- **[Playbook Ablation Study](docs/ABLATION.md):** Formal causal attribution report proving agent decisions account for $\ge 48\%$ of net recovery.
- **[Gate Security Invariants](docs/GATE_INVARIANTS.md):** Cryptographic `GatePassport` specification and non-bypassability proofs.
- **[Compliance Architecture](docs/COMPLIANCE.md):** Complete regulatory framework (RBI, TRAI, DPDP) and the 9 stopping rules.
- **[Honesty Disclosure](docs/HONESTY.md):** Simulation boundaries, ground truth isolation, and production migration roadmap.

---

## 👥 Project Team & License

Built with ❤️.  
MIT License.
