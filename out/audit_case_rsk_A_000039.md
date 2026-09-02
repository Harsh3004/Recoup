# Case Decision & Audit Timeline: `rsk_A_000039`

> **Question Answered:** *"Why did the agent take this specific action for customer Dev Shetty?"*

## 1. Case Overview

- **Customer:** **Dev Shetty** (`cus_000090`)
- **Segment / Language:** `B2C` · `HI`
- **Surface:** Surface **A**
- **Exposure at Stake:** **₹999.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`RECOVERED`**

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`INSUFFICIENT_FUNDS`**
- **Confidence:** **96.0%**
- **Systemic Outage Flag:** `NO`
- **LLM Reasoning Used:** `NO`
- **Evidence Chain:**
  - Issuer decline code 'BANK_DECLINE_NSF' indicates insufficient account balance
  - Customer typical salary credit day is 1th of month
  - Amount: ₹999.00 on UPI_AUTOPAY (BOB)
  - Recommendation: Salary-cycle aware smart retry

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`SMART_RETRY`**
- **Expected Net Value (EV):** **₹678.82**
- **Plan Status:** `ACTIVE`
- **Written EV Rationale:** Smart salary-cycle aware background retry: 68% recovery prob on customer observed credit day is 1th; zero customer goodwill cost; expected net value ₹678.82.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|
| 1 | `GATEWAY` | EXECUTE_GATEWAY_RETRY (Salary-Cycle Calendar Scheduled) | 2026-08-21T06:30:00.000Z | `EXECUTED` | PAYMENT_SUCCESS OR MANDATE_REVOKED |

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00001773` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 12:00). | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

### Message `com_00000021` via `GATEWAY`
- **Status:** `SENT` at 2026-08-21T06:30:00.000Z
- **Template ID:** `N/A`
- **Payload:**
```json
{
  "chargeId": "chg_687141060",
  "customerId": "cus_000090",
  "amountPaise": 99900,
  "scheduledAt": 1787293800000,
  "action": "SMART_RETRY_CHARGE_EXECUTION"
}
```

## 6. Final Recovery Outcome

- **Status:** **RECOVERED**
- **Recovered Amount:** **₹999.00**
- **Recovered At:** 2026-08-21T06:30:00.000Z
- **Channel:** `GATEWAY`
- **Attributed Playbook:** `SMART_RETRY`

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
| 46 | `aud_00000046` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INSUFFICIENT_FUNDS` | 2026-08-20T06:30:00.000Z | `fc7eeaf8d0a6e042...` |
| 5319 | `aud_00005319` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `9a76af6319512d62...` |
| 8383 | `aud_00008383` | `MID_LADDER_CANCELLED` | `SYSTEM` | `CANCEL_REMAINING_STEPS` | 2026-08-21T06:30:00.000Z | `c51f45e5f09889ee...` |
| 10678 | `aud_00010678` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `a3fb9c79ea4485dd...` |
| 13546 | `aud_00013546` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `d1a82139ed780846...` |
| 15900 | `aud_00015900` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `ab98939c88cfc145...` |
| 18849 | `aud_00018849` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INSUFFICIENT_FUNDS` | 2026-08-20T06:30:00.000Z | `080d16bbc876ec74...` |
| 20166 | `aud_00020166` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INSUFFICIENT_FUNDS` | 2026-08-20T06:30:00.000Z | `2d138eabb1981f78...` |
| 25400 | `aud_00025400` | `MID_LADDER_CANCELLED` | `SYSTEM` | `CANCEL_REMAINING_STEPS` | 2026-08-21T06:30:00.000Z | `830f4a83578a8622...` |
| 27656 | `aud_00027656` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INSUFFICIENT_FUNDS` | 2026-08-20T06:30:00.000Z | `101fdcce49c6f710...` |
