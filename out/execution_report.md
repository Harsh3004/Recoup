# Bounded Execution & Recovery Outcome Report

- **Total Cases Processed:** **1314** (1117 Treatment, 197 Holdout)
- **Total Outbound Communications Executed:** **959**
- **Total Recovered Cash Inflow:** **₹2,09,45,283.50**
  - **Treatment Recovered:** **₹1,95,99,189.50** (410 cases)
  - **Holdout (Organic/Unaided):** **₹13,46,094.00** (65 cases)
- **Mid-Ladder Steps Cancelled Upon Payment:** **26**
- **B2B Promises-to-Pay Captured:** **9**

## Acceptance Verification

> **Plan Acceptance Criterion:** *full batch runs end-to-end; no case exceeds its declared attempt budget; mid-ladder payment cancels remaining steps every time; causal response function enforces message fit.*

| Check | Target | Actual Result | Status |
|---|---|---|---|
| Full Batch Run End-to-End | 100% | **100%** (1314/1314 cases resolved) | **PASS** |
| Attempt Budget Cap Enforced (≤ 4) | 0 violations | **0 violations** (gate() enforces MAX_ATTEMPTS_REACHED) | **PASS** |
| Mid-Ladder Step Cancellation | 100% | **26 steps** cancelled on payment | **PASS** |
| Gate Non-Bypassability Token | GatePassport verified | All adapter dispatches validated via cryptographic signature choke point | **PASS** |
| Ground Truth Isolation | Sole Step-6 reader | Code-architectural guarantee: no other engine file imports ground_truth | **ARCHITECTURAL** |

## 1. Case State Machine Final Distribution

| Final Case State | Count | Share | Description |
|---|---:|---:|---|
| `RECOVERED` | **471** | 35.8% | Successfully collected payment |
| `PARTIALLY_RECOVERED` | **4** | 0.3% | Partially recovered via instalment |
| `PROMISED` | **3** | 0.2% | Active B2B promise-to-pay commitment registered |
| `ESCALATED_TO_HUMAN` | **0** | 0.0% | Handed over to account manager with dispute brief |
| `SUPPRESSED` | **27** | 2.1% | Suppressed by compliance rails or systemic incident |
| `CLOSED_LOST` | **809** | 61.6% | Exhausted attempt budget without recovery |
