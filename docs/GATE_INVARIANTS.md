# Recoup — Compliance Gate Invariants & Security Architecture

## 1. Overview & Architectural Role

The Recoup Compliance Gate (`engines/gate.ts`) is the **single architectural choke point** through which every outbound communication, gateway charge, and recovery action must pass before physical dispatch. `dispatchMockAdapter()` is the only customer-facing dispatch entry point exported by the `adapters` module.

```
       ┌───────────────────────┐
       │   Intervention Plan   │
       └──────────┬────────────┘
                  │ Proposed Step
                  ▼
       ┌───────────────────────┐
       │    Universal gate()   │◄──── RBI / TRAI Guardrails, 9 Stopping Rules
       └──────────┬────────────┘
                  │ Mints HMAC-SHA256 Signed GatePassport Token
                  ▼
       ┌───────────────────────┐
       │  dispatchMockAdapter  │◄──── Rejects any call lacking valid GatePassport binding
       └──────────┬────────────┘
                  │ Physical Payload Dispatch
                  ▼
       ┌───────────────────────┐
       │ Unified Audit Ledger  │◄──── SHA-256 Chaining with SQLite DB Triggers
       └───────────────────────┘
```

---

## 2. Invariants & Proof Mechanisms

### Invariant 1: Keyed `GatePassport` Execution Token (HMAC-SHA256)
- **Rule:** Raw formatters (`formatEmail`, `formatSms`, etc.) are internal to `adapters` and not exported. `dispatchMockAdapter()` rejects any call without an unexpired, authentic `GatePassport` matching the exact risk item, channel, action, and plan step.
- **Signature Mechanism:**
  $$\text{Signature} = \operatorname{HMAC-SHA256}(\text{passportId} \parallel \text{riskItemId} \parallel \text{planStepId} \parallel \text{channel} \parallel \text{action} \parallel \text{issuedAt} \parallel \text{expiresAt}, \text{GATE\_PASSPORT\_SECRET})$$
- **Verification:** `dispatchMockAdapter` validates the HMAC signature, risk item ID, channel, action, plan step ID, and expiry window ($4$ hours). A passport minted for an email reminder cannot be reused for a voice call or different action.
- **Test:** [`test/gate_invariants.test.ts`](../test/gate_invariants.test.ts) asserts that calling without passport, with forged signature, expired timestamp, mismatched action, or mismatched step throws a fatal `SECURITY_ERROR`.

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
