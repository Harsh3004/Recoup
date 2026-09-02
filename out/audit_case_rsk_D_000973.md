# Case Decision & Audit Timeline: `rsk_D_000973`

> **Question Answered:** *"Why did the agent take this specific action for customer Deccan Steel & Alloys Ltd?"*

## 1. Case Overview

- **Customer:** **Deccan Steel & Alloys Ltd** (`cus_001142`)
- **Segment / Language:** `ENTERPRISE` · `HINGLISH`
- **Surface:** Surface **D**
- **Exposure at Stake:** **₹5,00,000.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`RECOVERED`**

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`INVOICE_UNPAID`**
- **Confidence:** **94.0%**
- **Systemic Outage Flag:** `NO`
- **LLM Reasoning Used:** `YES`
- **Evidence Chain:**
  - Invoice overdue in 31_60 bucket with ambiguous correspondence
  - Outstanding amount: ₹5,00,000.00 (PAST_DUE)

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`PROMISE_TO_PAY`**
- **Expected Net Value (EV):** **₹4,09,989.10**
- **Plan Status:** `ACTIVE`
- **Written EV Rationale:** B2B Promise-to-Pay (PTP) Protocol: Captures binding payment commitment date with automated calendar tracking; expected net ₹4,09,989.10.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|
| 1 | `EMAIL` | SEND_STATEMENT_AND_PTP_REGISTRATION_LINK | 2026-08-20T10:30:00.000Z | `EXECUTED` | PROMISE_CAPTURED OR INVOICE_PAID |
| 2 | `WHATSAPP` | SEND_AP_DESK_PTP_CONFIRMATION_REQUEST | 2026-08-22T06:30:00.000Z | `CANCELLED` | PROMISE_CAPTURED OR INVOICE_PAID |

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00001118` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 16:00). | 2026-08-20T06:30:00.000Z |
| `dec_00002378` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 12:00). | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

### Message `com_00001121` via `EMAIL`
- **Status:** `SENT` at 2026-08-20T10:30:00.000Z
- **Template ID:** `tpl_email_promise_to_pay_s1`
- **Payload:**
```json
{
  "to": "ap.1142@deccan.steel.alloys.ltd.corp.recoup.test",
  "recipientName": "Deccan Steel & Alloys Ltd",
  "subject": "Statement of Account & Payment Schedule Confirmation (₹5,00,000.00)",
  "body": "Dear Deccan Steel & Alloys Ltd,\n\nAttached is your latest statement of account for ₹5,00,000.00. Please confirm your expected payment date or complete payment online here:\n\nhttps://rzp.io/i/rec_D_000973_1214b199ad\n\nWarm regards,\nCredit Control Team",
  "paymentUrl": "https://rzp.io/i/rec_D_000973_1214b199ad",
  "amount": "₹5,00,000.00"
}
```

## 6. Final Recovery Outcome

- **Status:** **RECOVERED**
- **Recovered Amount:** **₹5,00,000.00**
- **Recovered At:** 2026-08-23T10:30:00.000Z
- **Channel:** `EMAIL`
- **Attributed Playbook:** `PROMISE_TO_PAY`

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
