# Recoup — Compliance Gate Invariants & Security Architecture

## 1. Overview & Architectural Role

The Recoup Compliance Gate (`engines/gate.ts`) is the **single, non-bypassable choke point** through which every outbound communication, gateway charge, and recovery action must pass before physical dispatch.

```
       ┌───────────────────────┐
       │   Intervention Plan   │
       └──────────┬────────────┘
                  │ Proposed Step
                  ▼
       ┌───────────────────────┐
       │    Universal gate()   │◄──── RBI / TRAI Guardrails, 9 Stopping Rules
       └──────────┬────────────┘
                  │ Mints Signed GatePassport Token
                  ▼
       ┌───────────────────────┐
       │  dispatchMockAdapter  │◄──── Rejects any call lacking a valid GatePassport
       └──────────┬────────────┘
                  │ Physical Payload Dispatch
                  ▼
       ┌───────────────────────┐
       │ Unified Audit Ledger  │◄──── Cryptographic SHA-256 Chaining with DB Triggers
       └───────────────────────┘
```

---

## 2. Invariants & Proof Mechanisms

### Invariant 1: Unforgeable `GatePassport` Execution Token
- **Rule:** No adapter (`formatEmail`, `formatSms`, `formatWhatsApp`, `formatVoiceTranscript`, `formatGatewayCharge`) will format or dispatch a payload without a valid, unexpired `GatePassport`.
- **Signature Mechanism:**
  $$\text{Signature} = \operatorname{SHA-256}(\text{passportId} \parallel \text{riskItemId} \parallel \text{planStepId} \parallel \text{channel} \parallel \text{action} \parallel \text{issuedAt} \parallel \text{expiresAt} \parallel \text{SECRET})$$
- **Verification:** `dispatchMockAdapter` validates the signature, risk item ID, channel, and expiry window ($4$ hours).
- **Test:** [`test/gate_invariants.test.ts`](../test/gate_invariants.test.ts) asserts that calling any adapter directly or with a forged signature throws a fatal `SECURITY_ERROR`.

### Invariant 2: Static AST Import Isolation
- **Rule:** Adapters can **never** be imported or executed anywhere outside `engines/execute.ts`.
- **Test:** AST analysis in `test/gate_invariants.test.ts` scans all other engine files to ensure zero adapter imports exist outside the authorized runner.

### Invariant 3: Timezone-Aware Quiet Hours
- **Rule:** 
  - Voice calls restricted to 08:00–19:00 in customer's local timezone (RBI Fair Practices Code).
  - Commercial SMS/WhatsApp restricted to 08:00–21:00 in customer's local timezone (TRAI).
- **Boundary Proof:** `07:59:59` is blocked; `08:00:00` is allowed; `21:00:01` is blocked.

### Invariant 4: Systemic Outage & Circuit Breaker Suppression
- **Rule:** When an anomaly detector identifies gateway/issuer degradation ($z < -3.0$), 100% of open risk items linked to the affected gateway $\times$ issuer are blocked with `BLOCK: SYSTEMIC_INCIDENT`.

### Invariant 5: Append-Only Immutable Audit Trail
- **Rule:** Every gate decision (`GATE_ALLOWED`, `GATE_BLOCKED`) is committed to the SHA-256 hash chain with SQLite `BEFORE UPDATE` and `BEFORE DELETE` triggers raising an abort.

---

## 3. Verification Suite

Run the full invariant and security test suite:
```bash
bun test test/gate_invariants.test.ts
bun test test/tamper.test.ts
```
All tests pass in cold isolation without external dependencies.
