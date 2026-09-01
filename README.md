# Recoup — Autonomous Failed Payment Recovery & Compliance Engine

> **Recoup** is an autonomous, compliance-first failed payment recovery platform that diagnoses root causes across 4 Indian transaction surfaces via structured LLM NLU, optimizes recovery via Expected Value (EV) playbooks, enforces strict RBI/TRAI guardrails through cryptographic `GatePassport` tokens, and proves true causal incremental lift via a 15% randomized holdout.

---

## 🏆 Headline Results

Across a simulated economy of 1,200 businesses, 13,626 payment attempts, and ₹18.65 Crore in total failure exposure:

- **Net Incremental ₹ Recovered (R1):** **₹2,38,17,692.70** (**+317.0% lift** over the 15% control holdout baseline).
- **Gross Treatment Cash Collected:** **₹3,13,30,061.00** (412 cases recovered across 1,117 treatment cases).
- **Causal Playbook Ablation Degradation:** **-172.0% drop** when agent intelligence is replaced with naive dunning (Target: $\ge 25\%$, **PASS**).
- **Diagnostic NLU Evaluation:** **95.8% vs 20.8%** (+75.0% semantic generalization advantage over regex rules) on the independent, unkeyworded AP dispute dataset (`bun run eval:diagnosis-independent`). Synthetic seeded corpus contract self-consistency: 100.0% (`bun run benchmark:llm`).
- **95% Bootstrap Confidence Interval:** **[₹87,90,260.89, ₹4,12,02,537.86]** (1,000 stratified resamples, statistically significant non-zero lower bound).
- **Sensitivity Band (±1 SE on Holdout Scaling):** **[₹2,11,79,687.52, ₹2,64,55,697.88]**.
- **Contacts Suppressed by Compliance Rails (R2/R3):** **682 actions blocked** (zero quiet hours breaches, zero DND violations, zero customer contacts during gateway outages).
- **Audit Ledger Integrity (R4):** **8,308 events** verified on an end-to-end SHA-256 hash chain protected by SQLite triggers (`bun run verify`).

---

## ⚡ Reproduce Everything in < 60 Seconds

```bash
# 1. Install dependencies (Bun v1.0+)
bun install

# 2. Deterministic seed verification (fixed seed 42)
bun run seed:verify

# 3. Run automated unit & security invariant tests (27/27 pass in ~250ms)
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

# 5. Run causal ablation & diagnostic benchmarks
bun run ablate                        # Counterfactual policy ablation (-172.0% degradation)
bun run eval:diagnosis-independent    # Independent unkeyworded NLU benchmark (95.8% vs 20.8%)
bun run benchmark:llm                 # Seeded corpus interface contract self-consistency check

# 6. Launch interactive executive demo dashboard
bun run demo
# Open http://localhost:80 in your browser
```

---

## 📐 Architecture & Data Flow

![Recoup Pipeline Architecture](assets/pipeline-flowchart.jpg)

*The pipeline flows through six stages: (1) signal detection across four transaction surfaces with outage-aware anomaly detection, (2) structured LLM NLU diagnosis, (3) EV-optimized playbook selection, (4) a centralized compliance gate enforcing quiet hours, TRAI DLT, RBI pre-debit notice, and the 9 stopping rules via HMAC-SHA256 GatePassport tokens, (5) mock-adapter execution (the only exported dispatch entry point in the codebase) with causal outcome resolution against a hidden ground truth, and (6) tamper-evident audit logging paired with stratified holdout measurement.*

> **Reading the measurement report honestly:** ~94% of the net incremental recovery comes from Surface D (B2B high-value invoices), where root-cause diagnosis (PO/GRN vs. cash crunch vs. approval queue) most sharply differentiates playbook selection. Surface A (subscriptions) shows a slightly **negative** incremental (-₹3.01L) — the agent underperforms the organic baseline there due to strict mandate friction. Surface B and C are modestly positive. The "all four surfaces, unified" pitch is architecturally accurate; economically, the B2B lift is the headline driver. Full breakdown: `out/measurement_report.md`.

> **Simulation disclosure:** All ₹ figures are properties of a simulated economy (synthetic customers, seeded PRNG outcomes, mock adapter dispatches). No real payments were attempted or collected. The lift is a property of the outcome resolution model — bounded, fatigued, and honestly calibrated — not external market validation. Full disclosure: `docs/HONESTY.md`.

---

## 🎯 The Four Scoring Requirements (R1 – R4)

| Requirement | Implementation & Location | Verification Output |
|---|---|---|
| **R1: Incremental ₹ Recovered** | [`engines/measure.ts`](engines/measure.ts)<br>Stratum-weighted estimation with small-strata empirical shrinkage & 1,000-sample bootstrap 95% CI. | **₹2,38,17,692.70 net incremental recovery**<br>95% CI: `[₹87.90 L – ₹4.12 Cr]` (`out/measurement_report.md`) |
| **R2: Strict Compliance Rails** | [`engines/gate.ts`](engines/gate.ts)<br>Choke point `gate()` minting HMAC-SHA256 `GatePassport` tokens (the only exported dispatch path) enforcing 9 stopping rules, TRAI DLT, and RBI 24h notice. | **682 actions blocked**<br>0 sends to opted-out contacts; 0 sends during outage (`out/suppression_report.md`) |
| **R3: Tone Ladder & Quiet Hours** | [`engines/gate.ts`](engines/gate.ts) + [`adapters/voice.ts`](adapters/voice.ts)<br>Strict timezone enforcement (08:00–19:00 for voice) and bilingual Hinglish scripts. | **Zero quiet hours violations**<br>29 touches blocked outside window; 11/11 gate tests pass · 27/27 suite total (`bun test`) |
| **R4: Tamper-Evident Audit Trail** | [`engines/audit.ts`](engines/audit.ts)<br>End-to-end SHA-256 hash chaining ($H_i = \operatorname{SHA-256}(H_{i-1} \parallel \operatorname{canonical}(P_i))$) with SQLite abort triggers. | **8,308 events verified against genesis**<br>Live tamper detection validated (`bun run verify`) |

---

## ⚖️ Counterfactual & Ablation Comparison

| Recovery Strategy | Gross Collected | Comms Cost | Net Realized Value | Lift vs Organic Holdout | Causal Degradation |
|---|---:|---:|---:|---:|---:|
| **Pure Holdout Control (Unaided Baseline)** | ₹75,12,368.30 | ₹0.00 | ₹75,12,368.30 | 0.0% | — |
| **Identical Naive Dunning Arm (Ablated)** | ₹77,576.00 | ₹670.20 | -₹74,34,792.30 | -198.9% | **-172.0%** |
| **Random Applicable Playbook Arm** | ₹86,768.00 | ₹1,520.00 | -₹74,25,600.30 | -198.8% | **-171.9%** |
| **Recoup Autonomous Engine** | **₹3,13,30,061.00** | **₹2,085.00** | **₹2,38,17,692.70** | **+317.0%** | **Baseline (0.0%)** |

---

## 🔍 In-Depth Technical Documents

- **[Playbook Ablation Study](docs/ABLATION.md):** Formal causal attribution report proving agent decisions account for $>50\%$ of net recovery.
- **[Gate Security Invariants](docs/GATE_INVARIANTS.md):** Cryptographic `GatePassport` specification and non-bypassability proofs.
- **[Compliance Architecture](docs/COMPLIANCE.md):** Complete regulatory framework (RBI, TRAI, DPDP) and the 9 stopping rules.
- **[Honesty Disclosure](docs/HONESTY.md):** Simulation boundaries, ground truth isolation, and production migration roadmap.

---

## 👥 Project Team & License

Built with ❤️.  
MIT License.
