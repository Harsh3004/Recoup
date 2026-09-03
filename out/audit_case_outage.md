# Case Decision & Audit Timeline: `rsk_A_000313`

> **Question Answered:** *"Why did the agent take this specific action for customer Divya Kumar?"*

## 1. Case Overview

- **Customer:** **Divya Kumar** (`cus_000476`)
- **Segment / Language:** `B2C` · `EN`
- **Surface:** Surface **A**
- **Exposure at Stake:** **₹999.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`SUPPRESSED`**
- **Systemic Incident Tag:** `inc_000001` (Outage Protected)

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`SYSTEMIC_GATEWAY_OUTAGE`**
- **Confidence:** **99.0%**
- **Systemic Outage Flag:** `YES`
- **LLM Reasoning Used:** `NO`
- **Evidence Chain:**
  - Active incident inc_000001 detected on razorpay × HDFC
  - Severe degradation on razorpay × HDFC: success rate dropped to 26.7% (baseline 80.6%, z = -7.14, 88/120 attempts failed)
  - Decline code was 'BANK_DOWNTIME' during outage window
  - Rule: Zero customer contact during systemic incident; suppress and route to ops

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`SYSTEMIC_SUPPRESSION`**
- **Expected Net Value (EV):** **₹0.00**
- **Plan Status:** `SKIPPED (SYSTEMIC_INCIDENT)`
- **Written EV Rationale:** Active systemic incident (inc_000001). Suppression rule: 100% customer contact halted; ops incident ticket created.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00000004` | 🛑 BLOCK | `SYSTEMIC_INCIDENT` | Active systemic gateway degradation (inc_000001). Customer contact suppressed by rule. | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

Zero outbound communications dispatched (Suppressed by compliance rails or control holdout).
## 6. Final Recovery Outcome

- **Status:** `SUPPRESSED` (No cash recovered)

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
| 320 | `aud_00000320` | `DIAGNOSIS_COMMITTED` | `AGENT` | `SYSTEMIC_GATEWAY_OUTAGE` | 2026-08-20T06:30:00.000Z | `9d08811b361aadb1...` |
| 2610 | `aud_00002610` | `GATE_BLOCKED` | `AGENT` | `BLOCK` | 2026-08-20T06:30:00.000Z | `cc88abf1e47ed6f2...` |
| 5985 | `aud_00005985` | `CASE_STATE_TRANSITION` | `AGENT` | `SUPPRESS` | 2026-08-20T06:30:00.000Z | `3e26ab5eced6ff81...` |
