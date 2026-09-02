# Case Decision & Audit Timeline: `rsk_D_000977`

> **Question Answered:** *"Why did the agent take this specific action for customer Sahyadri Agro Processing Ltd?"*

## 1. Case Overview

- **Customer:** **Sahyadri Agro Processing Ltd** (`cus_001145`)
- **Segment / Language:** `ENTERPRISE` · `EN`
- **Surface:** Surface **D**
- **Exposure at Stake:** **₹50,00,000.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`PROMISED`**

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`INVOICE_UNPAID`**
- **Confidence:** **94.0%**
- **Systemic Outage Flag:** `NO`
- **LLM Reasoning Used:** `NO`
- **Evidence Chain:**
  - Rules classifier fallback (LLM skipped: no_api_key)
  - Invoice overdue in 0_30 bucket with standard terms
  - Outstanding amount: ₹50,00,000.00 (PAST_DUE)

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`PROMISE_TO_PAY`**
- **Expected Net Value (EV):** **₹40,99,989.10**
- **Plan Status:** `ACTIVE`
- **Written EV Rationale:** B2B Promise-to-Pay (PTP) Protocol: Captures binding payment commitment date with automated calendar tracking; expected net ₹40,99,989.10.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|
| 1 | `EMAIL` | SEND_STATEMENT_AND_PTP_REGISTRATION_LINK | 2026-08-20T10:30:00.000Z | `EXECUTED` | PROMISE_CAPTURED OR INVOICE_PAID |
| 2 | `WHATSAPP` | SEND_AP_DESK_PTP_CONFIRMATION_REQUEST | 2026-08-22T06:30:00.000Z | `CANCELLED` | PROMISE_CAPTURED OR INVOICE_PAID |

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00001122` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 16:00). | 2026-08-20T06:30:00.000Z |
| `dec_00002382` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 12:00). | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

### Message `com_00000715` via `EMAIL`
- **Status:** `SENT` at 2026-08-20T10:30:00.000Z
- **Template ID:** `tpl_email_promise_to_pay_s1`
- **Payload:**
```json
{
  "to": "ap.1145@sahyadri.agro.processing.ltd.corp.recoup.test",
  "recipientName": "Sahyadri Agro Processing Ltd",
  "subject": "Statement of Account & Payment Schedule Confirmation (₹50,00,000.00)",
  "body": "Dear Sahyadri Agro Processing Ltd,\n\nAttached is your latest statement of account for ₹50,00,000.00. Please confirm your expected payment date or complete payment online here:\n\nhttps://rzp.io/i/rec_D_000977_08b52ded2d\n\nWarm regards,\nCredit Control Team",
  "paymentUrl": "https://rzp.io/i/rec_D_000977_08b52ded2d",
  "amount": "₹50,00,000.00"
}
```

## 6. Final Recovery Outcome

- **Status:** `PROMISED` (No cash recovered)

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
| 1051 | `aud_00001051` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INVOICE_UNPAID` | 2026-08-20T06:30:00.000Z | `cb1e88cae6dbc815...` |
| 10119 | `aud_00010119` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `c26ef38f6b69d92a...` |
| 12932 | `aud_00012932` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `f732751e80b85a6f...` |
| 15284 | `aud_00015284` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `102622b07c24f324...` |
| 18221 | `aud_00018221` | `CASE_STATE_TRANSITION` | `AGENT` | `CLOSE` | 2026-08-27T06:30:00.000Z | `b004b605ca272f20...` |
| 19854 | `aud_00019854` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INVOICE_UNPAID` | 2026-08-20T06:30:00.000Z | `f0ecedd2f2b96f73...` |
| 21171 | `aud_00021171` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INVOICE_UNPAID` | 2026-08-20T06:30:00.000Z | `bea882c5d523b2f7...` |
| 28661 | `aud_00028661` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INVOICE_UNPAID` | 2026-08-20T06:30:00.000Z | `7b4258626a900cb8...` |
