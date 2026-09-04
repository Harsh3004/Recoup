# Case Decision & Audit Timeline: `rsk_A_000002`

> **Question Answered:** *"Why did the agent take this specific action for customer Nikhil Singh?"*

## 1. Case Overview

- **Customer:** **Nikhil Singh** (`cus_000004`)
- **Segment / Language:** `B2C` · `EN`
- **Surface:** Surface **A**
- **Exposure at Stake:** **₹199.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`RECOVERED`**

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`TECHNICAL_TRANSIENT`**
- **Confidence:** **88.0%**
- **Systemic Outage Flag:** `NO`
- **LLM Reasoning Used:** `NO`
- **Evidence Chain:**
  - Transient gateway / network error code 'GATEWAY_TIMEOUT' on paytm
  - Isolated transient failure outside declared systemic incidents
  - Recommendation: Automated jittered exponential retry

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`SMART_RETRY`**
- **Expected Net Value (EV):** **₹148.75**
- **Plan Status:** `ACTIVE`
- **Written EV Rationale:** Smart salary-cycle aware background retry: 75% recovery prob on customer observed credit day is 2th; zero customer goodwill cost; expected net value ₹148.75.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|
| 1 | `GATEWAY` | EXECUTE_GATEWAY_RETRY (Salary-Cycle Calendar Scheduled) | 2026-08-20T12:30:00.000Z | `EXECUTED` | PAYMENT_SUCCESS OR MANDATE_REVOKED |

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00001316` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: America/New_York, Local Hour: 8:00). | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

### Message `com_00000002` via `GATEWAY`
- **Status:** `SENT` at 2026-08-20T12:30:00.000Z
- **Template ID:** `N/A`
- **Payload:**
```json
{
  "chargeId": "chg_389715376",
  "customerId": "cus_000004",
  "amountPaise": 19900,
  "scheduledAt": 1787229000000,
  "action": "SMART_RETRY_CHARGE_EXECUTION"
}
```

## 6. Final Recovery Outcome

- **Status:** **RECOVERED**
- **Recovered Amount:** **₹199.00**
- **Recovered At:** 2026-08-20T12:30:00.000Z
- **Channel:** `GATEWAY`
- **Attributed Playbook:** `SMART_RETRY`

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
| 9 | `aud_00000009` | `DIAGNOSIS_COMMITTED` | `AGENT` | `TECHNICAL_TRANSIENT` | 2026-08-20T06:30:00.000Z | `2770cf7754498fec...` |
| 5224 | `aud_00005224` | `MID_LADDER_CANCELLED` | `SYSTEM` | `CANCEL_REMAINING_STEPS` | 2026-08-20T12:30:00.000Z | `4b4c231aff799b4b...` |
