# Case Decision & Audit Timeline: `rsk_D_000976`

> **Question Answered:** *"Why did the agent take this specific action for customer Northern Grid Power Ltd?"*

## 1. Case Overview

- **Customer:** **Northern Grid Power Ltd** (`cus_001144`)
- **Segment / Language:** `ENTERPRISE` · `HI`
- **Surface:** Surface **D**
- **Exposure at Stake:** **₹20,00,000.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`PROMISED`**

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`INVOICE_UNPAID`**
- **Confidence:** **94.0%**
- **Systemic Outage Flag:** `NO`
- **LLM Reasoning Used:** `YES`
- **Evidence Chain:**
  - Invoice overdue in 0_30 bucket with standard terms
  - Outstanding amount: ₹20,00,000.00 (PAST_DUE)

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`PROMISE_TO_PAY`**
- **Expected Net Value (EV):** **₹16,39,989.10**
- **Plan Status:** `ACTIVE`
- **Written EV Rationale:** B2B Promise-to-Pay (PTP) Protocol: Captures binding payment commitment date with automated calendar tracking; expected net ₹16,39,989.10.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|
| 1 | `EMAIL` | SEND_STATEMENT_AND_PTP_REGISTRATION_LINK | 2026-08-20T10:30:00.000Z | `EXECUTED` | PROMISE_CAPTURED OR INVOICE_PAID |
| 2 | `WHATSAPP` | SEND_AP_DESK_PTP_CONFIRMATION_REQUEST | 2026-08-22T06:30:00.000Z | `CANCELLED` | PROMISE_CAPTURED OR INVOICE_PAID |

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00001121` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 16:00). | 2026-08-20T06:30:00.000Z |
| `dec_00002381` | 🛑 BLOCK | `CHANNEL_CONSENT_MISSING` | Customer consent for WHATSAPP is 0. | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

### Message `com_00001108` via `EMAIL`
- **Status:** `SENT` at 2026-08-20T10:30:00.000Z
- **Template ID:** `tpl_email_promise_to_pay_s1`
- **Payload:**
```json
{
  "to": "ap.1144@northern.grid.power.ltd.corp.recoup.test",
  "recipientName": "Northern Grid Power Ltd",
  "subject": "Statement of Account & Payment Schedule Confirmation (₹20,00,000.00)",
  "body": "Dear Northern Grid Power Ltd,\n\nAttached is your latest statement of account for ₹20,00,000.00. Please confirm your expected payment date or complete payment online here:\n\nhttps://rzp.io/i/rec_D_000976_3cad114ef2\n\nWarm regards,\nCredit Control Team",
  "paymentUrl": "https://rzp.io/i/rec_D_000976_3cad114ef2",
  "amount": "₹20,00,000.00"
}
```

## 6. Final Recovery Outcome

- **Status:** `PROMISED` (No cash recovered)

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
| 1050 | `aud_00001050` | `DIAGNOSIS_COMMITTED` | `AGENT` | `INVOICE_UNPAID` | 2026-08-20T06:30:00.000Z | `aefd4c059df64fb0...` |
