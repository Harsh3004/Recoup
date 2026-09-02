# Seed report — Recoup simulated economy

- **Seed:** `42`
- **As-of:** 2026-08-20T12:00:00+05:30
- **DB:** `data/recovery.db`
- **Fingerprint:** `customers:1200|subscriptions:877|mandates:877|payment_attempts:13626|checkout_sessions:500|invoices:363|gateway_health:1033|ground_truth:1200|ground_truth_events:1314|dlt_templates:7|pay_sum:3279087400|chk_sum:205312000|inv_sum:25964500000|ltv:2863382200|49e625a9062b5b755b2053e88000272d9f3cc01bc2ba70a128c768b6c7455261`
- **Re-run:** `bun run seed -- --seed 42`

## Acceptance

Plan: *batch of ≥1,000 risk-bearing events, total ₹ at risk printed by surface; re-runnable with a fixed seed for identical results.*

| Check | Result |
|---|---|
| Risk-bearing events | **1314** PASS |
| ₹ at risk (all surfaces) | **₹18,64,72,663.00** |
| Deterministic seed | `42` (see fingerprint) |

## ₹ at risk by surface

| Surface | Events | ₹ at risk |
|---|---:|---:|
| A Payment failure | 471 | ₹9,15,329.00 |
| B Checkout abandonment | 380 | ₹20,53,120.00 |
| C Mandate breakage | 186 | ₹2,80,414.00 |
| D B2B receivables | 277 | ₹18,32,23,800.00 |
| **Total** | **1314** | **₹18,64,72,663.00** |

Surface A excludes failed charges whose mandate is already broken (those rupees live on C).

## Population

| | Count |
|---|---:|
| Customers | 1200 |
| Subscriptions | 877 |
| Mandates | 877 |
| Payment attempts | 13626 |
| Checkout sessions | 500 |
| Invoices | 363 |
| Incidents table (must be 0 until Step 2) | 0 |
| Audit events | 3 |

### Segment

- B2C: 900
- ENTERPRISE: 60
- SMB: 240

### Language

- EN: 473
- HI: 306
- HINGLISH: 421

### Compliance fixtures

- DND: 90
- Opted out: 40
- Fraud flag: 8
- Bankruptcy flag: 6

## Payment mix (mandates)

- UPI_AUTOPAY: 377 (43.0%)
- CARD: 236 (26.9%)
- ENACH: 213 (24.3%)
- NETBANKING: 51 (5.8%)

## Decline-code distribution

### All failures (includes injected outage)

| Category | N | Share |
|---|---:|---:|
| INSUFFICIENT_FUNDS | 569 | 32.6% |
| ISSUER_SOFT | 349 | 20.0% |
| TECHNICAL | 334 | 19.1% |
| EXPIRED_CARD | 257 | 14.7% |
| MANDATE | 154 | 8.8% |
| HARD_FRAUD | 85 | 4.9% |

### Ex-outage (should track the plan: 35 / 15 / 20 / 15 / 10 / 5)

| Category | N | Share |
|---|---:|---:|
| INSUFFICIENT_FUNDS | 569 | 34.3% |
| ISSUER_SOFT | 349 | 21.0% |
| EXPIRED_CARD | 257 | 15.5% |
| TECHNICAL | 246 | 14.8% |
| MANDATE | 154 | 9.3% |
| HARD_FRAUD | 85 | 5.1% |

## Injected systemic incident

- Gateway × issuer: **razorpay × HDFC**
- Window: 2026-08-19T10:00:00+05:30 → 2026-08-19T16:00:00+05:30 (6 hours)
- Attempts in window (all): 120 (88 failed)
- Razorpay × HDFC in window: 120 attempts, success 2666 bps (26.7%)
- Razorpay × HDFC outside window: 276 attempts, success 8840 bps (88.4%)
- `incidents` rows: 0 (detector must create this in Step 2)

## Invoice ageing (at-risk)

| Bucket | N | Outstanding |
|---|---:|---:|
| 0_30 | 107 | ₹7,58,02,250.00 |
| 31_60 | 94 | ₹6,36,88,150.00 |
| 61_90 | 50 | ₹2,96,12,400.00 |
| 90_PLUS | 26 | ₹1,41,21,000.00 |

## Ground truth (hidden)

- Customer rows: 1200, would_pay_anyway=487 (40.6%)
- Event rows: 1314, would_pay_anyway=443 (33.7%)
- Engines other than the Step 6 outcome resolver must not read these tables.

## Assumptions

1. Decline taxonomy as in `docs/DATA_DICTIONARY.md` (plan listed buckets, not ISO8583 codes).
2. Event-level truth lives in `ground_truth_events` because root cause is per leak, not per customer.
3. Probabilities stored as integer bps. Display percentages in this report are derived with integer tenths.
4. A small NRI timezone slice (Dubai/London/NY) exists so quiet-hours is demonstrable.
5. TRAI DLT templates are pre-seeded; the `incidents` table is intentionally empty.
6. Monthly cadence uses calendar month addition from start date, not a fixed 30-day period.

## Next

Step 2 — Detection engine: map every leak to one `risk_item`, flag the outage as an incident, stratified holdout.