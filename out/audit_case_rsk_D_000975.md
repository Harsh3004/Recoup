# Case Decision & Audit Timeline: `rsk_D_000975`

> **Question Answered:** *"Why did the agent take this specific action for customer Coastal Freight India Ltd?"*

## 1. Case Overview

- **Customer:** **Coastal Freight India Ltd** (`cus_001143`)
- **Segment / Language:** `ENTERPRISE` · `EN`
- **Surface:** Surface **D**
- **Exposure at Stake:** **₹8,00,000.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`PARTIALLY_RECOVERED`**

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`CASH_CRUNCH`**
- **Confidence:** **95.0%**
- **Systemic Outage Flag:** `NO`
- **LLM Reasoning Used:** `YES`
- **Evidence Chain:**
  - LLM NLU Diagnosis (gemini-3.5-flash-lite, 1ms, 604 tokens [cache])
  - Rationale: The buyer explicitly acknowledges liability for the invoice but states that collections have slipped and requests to split the payment across multiple dates, which indicates a liquidity issue.
  - Evidence: "Collections from our retailers slipped this month. Can we split across two dates?"
  - Outstanding amount: ₹8,00,000.00 (PAST_DUE)

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`PARTIAL_PAYMENT`**
- **Expected Net Value (EV):** **₹5,59,989.10**
- **Plan Status:** `ACTIVE`
- **Written EV Rationale:** Instalment & Partial Payment Agreement: Unlocks stalled receivables for cash-crunched account; preserves relationship; expected net ₹5,59,989.10.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|
| 1 | `EMAIL` | PROPOSE_STRUCTURED_INSTALMENT_SCHEDULE | 2026-08-20T09:30:00.000Z | `EXECUTED` | INSTALMENT_AGREED OR INVOICE_PAID |
| 2 | `WHATSAPP` | SEND_PARTIAL_PAYMENT_INITIATION_LINK | 2026-08-21T06:30:00.000Z | `CANCELLED` | INSTALMENT_AGREED OR INVOICE_PAID |

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00000651` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 15:00). | 2026-08-20T06:30:00.000Z |
| `dec_00002119` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 12:00). | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

### Message `com_00001112` via `EMAIL`
- **Status:** `SENT` at 2026-08-20T09:30:00.000Z
- **Template ID:** `tpl_email_partial_payment_s1`
- **Payload:**
```json
{
  "to": "ap.1143@coastal.freight.india.ltd.corp.recoup.test",
  "recipientName": "Coastal Freight India Ltd",
  "subject": "Instalment payment plan options for Invoice ₹8,00,000.00",
  "body": "Dear Coastal Freight India Ltd,\n\nWe understand cash flow timing can be tight. We are pleased to offer a structured 3-part instalment plan for your pending invoice of ₹8,00,000.00.\n\nReview plan details here: https://rzp.io/i/rec_D_000975_b4b8eceb7d\n\nRegards,\nFinance Team",
  "paymentUrl": "https://rzp.io/i/rec_D_000975_b4b8eceb7d",
  "amount": "₹8,00,000.00"
}
```

## 6. Final Recovery Outcome

- **Status:** **RECOVERED**
- **Recovered Amount:** **₹6,00,000.00**
- **Recovered At:** 2026-08-23T09:30:00.000Z
- **Channel:** `EMAIL`
- **Attributed Playbook:** `PARTIAL_PAYMENT`

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
| 1049 | `aud_00001049` | `DIAGNOSIS_COMMITTED` | `AGENT` | `CASH_CRUNCH` | 2026-08-20T06:30:00.000Z | `fd516d17bec6d1ca...` |
| 9357 | `aud_00009357` | `DIAGNOSIS_COMMITTED` | `AGENT` | `CASH_CRUNCH` | 2026-08-20T06:30:00.000Z | `f477d3125f9ea6e0...` |
