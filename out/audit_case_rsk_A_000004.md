# Case Decision & Audit Timeline: `rsk_A_000004`

> **Question Answered:** *"Why did the agent take this specific action for customer Tanvi Nair?"*

## 1. Case Overview

- **Customer:** **Tanvi Nair** (`cus_000007`)
- **Segment / Language:** `B2C` · `EN`
- **Surface:** Surface **A**
- **Exposure at Stake:** **₹199.00**
- **Cohort:** `TREATMENT`
- **Current Case State:** **`RECOVERED`**

## 2. Root-Cause Diagnosis

- **Diagnosed Root Cause:** **`ISSUER_SOFT_DECLINE`**
- **Confidence:** **92.0%**
- **Systemic Outage Flag:** `NO`
- **LLM Reasoning Used:** `NO`
- **Evidence Chain:**
  - Issuer soft decline 'ISSUER_DECLINED' (temporary authentication or risk hurdle)
  - Issuer requested step-up authentication or temporary retry
  - Recommendation: Graded dunning ladder or 1-tap UPI payment link

## 3. Intervention Plan & Expected Value Rationale

- **Selected Playbook:** **`ONE_TAP_UPI`**
- **Expected Net Value (EV):** **₹151.32**
- **Plan Status:** `ACTIVE`
- **Written EV Rationale:** One-Tap UPI Intent Link: Lowest friction recovery path in India; 78% expected conversion; net EV ₹151.32.

### Scheduled Step Ladder
| Step | Channel | Action | Scheduled At (UTC) | Status | Exit Criteria |
|---:|---|---|---|---|---|
| 1 | `WHATSAPP` | SEND_DYNAMIC_UPI_INTENT_LINK_AND_QR | 2026-08-20T07:00:00.000Z | `EXECUTED` | PAYMENT_SUCCESS |
| 2 | `SMS` | SEND_DLT_UPI_RECOVERY_LINK | 2026-08-20T10:30:00.000Z | `EXECUTED` | PAYMENT_SUCCESS |

## 4. Compliance Gate Decisions

| Gate ID | Allowed | Reason Code | Details | Decided At (UTC) |
|---|:---:|---|---|---|
| `dec_00000034` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 12:00). | 2026-08-20T06:30:00.000Z |
| `dec_00000675` | ✅ ALLOW | `ALLOWED` | All 9 stopping rules and compliance rails passed (Timezone: Asia/Kolkata, Local Hour: 16:00). | 2026-08-20T06:30:00.000Z |

## 5. Communications Dispatched

### Message `com_00000004` via `WHATSAPP`
- **Status:** `SENT` at 2026-08-20T07:00:00.000Z
- **Template ID:** `wa_tpl_one_tap_upi_en`
- **Payload:**
```json
{
  "phone": "+919624331443",
  "header": "*Payment Reminder*",
  "body": "Hi Tanvi Nair, your payment of *₹199.00* is currently due.",
  "buttons": [
    {
      "type": "URL",
      "text": "Pay Now via UPI / Card",
      "url": "https://rzp.io/i/rec_A_000004_1c8357e693"
    },
    {
      "type": "QUICK_REPLY",
      "text": "Need Assistance"
    }
  ],
  "paymentUrl": "https://rzp.io/i/rec_A_000004_1c8357e693",
  "language": "EN"
}
```

### Message `com_00000005` via `SMS`
- **Status:** `SENT` at 2026-08-20T10:30:00.000Z
- **Template ID:** `dlt_sms_upi_retry_1`
- **Payload:**
```json
{
  "phone": "+919624331443",
  "dltEntityId": "RECOUP_DLT_110001",
  "templateId": "dlt_sms_upi_retry_1",
  "text": "Dear Tanvi Nair, complete your ₹199.00 payment via UPI in 1 tap: https://rzp.io/i/rec_A_000004_1c8357e693 - Recoup Fin",
  "paymentUrl": "https://rzp.io/i/rec_A_000004_1c8357e693"
}
```

## 6. Final Recovery Outcome

- **Status:** **RECOVERED**
- **Recovered Amount:** **₹199.00**
- **Recovered At:** 2026-08-20T10:30:00.000Z
- **Channel:** `SMS`
- **Attributed Playbook:** `ONE_TAP_UPI`

## 7. Tamper-Evident Hash Chain Audit Events

| Seq | Event ID | Action | Actor | Decision | Timestamp | SHA-256 Hash |
|---:|---|---|---|---|---|---|
| 14 | `aud_00000014` | `MID_LADDER_CANCELLED` | `SYSTEM` | `CANCEL_REMAINING_STEPS` | 2026-08-20T10:30:00.000Z | `08cea65812ce0655...` |
