# Recoup Compliance Framework & Guardrails

Single source of truth for compliance architecture, legal mandates, and stopping rules.

---

## 1. Compliance Architecture

In the Recoup codebase, all customer-facing communications and recovery actions are architected to pass exclusively through a single choke point:
`gate(db, input) -> GateDecisionResult`.

The `adapters` module exports only `dispatchMockAdapter()`, which strictly requires a valid, HMAC-SHA256 signed `GatePassport` token minted by `gate()` before generating or transmitting any outgoing payload.

```
[ Intervention Plan Step ] ──▶ [ Universal Gate ] ──┬──▶ ALLOWED (mints GatePassport) ──▶ [ dispatchMockAdapter ]
                                                    └──▶ BLOCKED (records reason)    ──▶ [ gate_decisions Log ]
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

## 4. Auditability & Hash Chain

Every gate decision (both `ALLOWED` and `BLOCKED`) is appended to `gate_decisions` and hashed into the tamper-evident `audit_events` ledger.

---

## 5. Threat Model: What Is Protected vs What Is Not

To prevent overclaiming, we explicitly document the security boundaries and threat assumptions of the compliance gate and audit hash chain:

### What Is Protected (In-Scope Guarantees)
- **Application-Level Bypasses & Logic Bugs**:
  - `adapters/index.ts` intentionally does not export raw formatters (`formatEmail`, `formatSms`, etc.). The only exported entry point for customer-facing communication in the current codebase is `dispatchMockAdapter()`, which rejects any call lacking an authentic, unexpired `GatePassport`.
  - Static AST invariant tests (`test/gate_invariants.test.ts`) assert that no application engine imports raw formatters or bypasses `dispatchMockAdapter`.
- **Token Tampering & Action Reuse**:
  - `GatePassport` tokens are signed using HMAC-SHA256 keyed with a runtime environment secret (`GATE_PASSPORT_SECRET`).
  - Tokens strictly bind `riskItemId`, `planStepId`, `channel`, `action`, and `expiresAt`. A passport minted for a low-touch email reminder cannot be reused for an aggressive voice call, a different action, or a different risk item.
- **Accidental State Mutation & Double Contact**:
  - Active promises-to-pay, mid-ladder payment arrivals, open disputes, or opt-outs immediately trigger stopping rules, preventing duplicate harassment.
- **Accidental Ledger Corruption**:
  - SQLite database triggers strictly abort any `UPDATE` or `DELETE` executed against `audit_events`.
  - The SHA-256 hash chain detects any out-of-order insertion, deletion, or payload modification within application-level execution.

### What Is NOT Protected (Explicit Non-Goals & Limitations)
- **Direct Database or Filesystem Access**:
  - If an adversary has direct write access to `recovery.db` via SQLite CLI, filesystem permissions, or root OS shell, they can drop the SQLite immutability triggers or alter table data directly.
- **Code-Modification / Runtime Host Compromise**:
  - A developer with direct code-modify access can add new unverified export functions, read `process.env.GATE_PASSPORT_SECRET` from memory, or modify the source code of `adapters/index.ts`.
  - The "non-bypassability" guarantee applies **strictly within the architectural boundary of the current codebase**, enforced via TypeScript module exports and AST unit tests.
- **No External Cryptographic Anchor (RFC 3161 / Blockchain)**:
  - The audit trail is an internal SHA-256 hash chain verified against genesis. It is **not** anchored to an external hardware security module (HSM), public blockchain, or third-party timestamping authority. An adversary with full code and database access who knows genesis could theoretically re-calculate the entire hash chain forward.
