# Recoup Compliance Framework & Guardrails

Single source of truth for compliance architecture, legal mandates, and stopping rules.

---

## 1. Compliance Architecture

All outbound communications and automated interventions pass through a single, non-bypassable gate function:
`gate(db, input) -> GateDecisionResult`.

```
[ Intervention Plan Step ] ──▶ [ Universal Gate ] ──┬──▶ ALLOWED ──▶ [ Adapter Dispatch ]
                                                    └──▶ BLOCKED ──▶ [ gate_decisions Log ]
```

---

## 2. Regulatory Alignment

### A. RBI Fair Practices Code & Recovery Norms
- **Quiet Hours**: Outbound interactive voice calls are restricted strictly between **08:00 and 19:00** in the customer's local timezone.
- **Tone Ladder**: Demands are strictly polite, informative, and collaborative. No coercive language, aggressive escalation, or public shaming.
- **Human Escalation**: Complex disputes and high-value B2B accounts are automatically handed over to designated account managers.

### B. RBI E-Mandate Framework
- **24-Hour Pre-Debit Notification**: Autopay debit retries enforce a 24-hour advance SMS/email notice before initiating debit execution.
- **AFA Limits**: Mandatory step-up Additional Factor of Authentication (AFA) for debits exceeding ₹15,000.

### C. TRAI Commercial Communications & DND
- **DLT Registration**: SMS communications bind strictly to pre-registered TRAI DLT template IDs. Unregistered templates are rejected before transmission.
- **National DND Registry**: Customers flagged in the National Do Not Disturb (DND) registry are suppressed from promotional and automated voice/SMS touches.

### D. Digital Personal Data Protection (DPDP)
- **Consent Registry**: Explicit consent flags (`consent_email`, `consent_sms`, `consent_whatsapp`, `consent_voice`) are checked on every touch.
- **Permanent Opt-Out**: Immediate and irrevocable suppression across all channels upon customer opt-out request.

---

## 3. The Nine Stopping Rules

| Rule | Trigger Condition | Action Taken |
|---|---|---|
| **PAID** | Customer paid mid-ladder or checkout converted | Cancel all remaining pending ladder steps |
| **PROMISE_TO_PAY_ACTIVE** | Customer logged binding payment commitment | Pause automated reminders until promised date |
| **DISPUTE_OPEN** | Formal B2B invoice dispute or mismatch filed | Freeze collections until dispute resolution |
| **OPTED_OUT** | Customer requested communication opt-out / DND | Permanent halt of outbound messages |
| **SYSTEMIC_INCIDENT** | Gateway or bank infrastructure degradation | Suppress customer contact; route to ops |
| **MAX_ATTEMPTS_REACHED** | 4 touchpoints reached without response | Halt ladder; avoid customer fatigue |
| **NEGATIVE_EV** | Expected recovery value $\le 0$ | Suppress touch; save channel & goodwill costs |
| **FRAUD_OR_BANKRUPTCY_FLAG** | Account flagged for fraud or legal insolvency | Suppress dunning; trigger risk review |
| **HUMAN_TAKEOVER** | Dedicated account manager assigned | Silence automated bots |

---

## 4. Auditability

Every gate decision (both `ALLOWED` and `BLOCKED`) is appended to `gate_decisions` and hashed into the tamper-evident `audit_events` ledger.
