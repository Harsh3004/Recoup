# Recoup data dictionary

All amounts are integer **paise** (INR). Booleans are `INTEGER` 0/1. Timestamps are Unix epoch **milliseconds**. Probabilities and rates are integer **basis points** (bps): 0–10000 = 0–100%.

SQLite file: `data/recovery.db`. DDL: `db/schema.sql`.

Architectural rule: **`ground_truth` and `ground_truth_events` are simulator-only.** No engine may read them except the Step 6 outcome resolver.

---

## Facts (the world)

### `customers`

| Column | Type | Meaning |
|---|---|---|
| id | TEXT PK | `cus_NNNNNN` |
| segment | TEXT | `B2C` \| `SMB` \| `ENTERPRISE` |
| name | TEXT | Display name |
| email | TEXT | Simulated address (`*.recoup.test`) |
| phone | TEXT | E.164 `+91…` |
| language | TEXT | `EN` \| `HI` \| `HINGLISH` |
| timezone | TEXT | IANA tz (quiet hours) |
| consent_email/sms/whatsapp/voice | INT | Channel consent |
| dnd | INT | TRAI DND registry |
| opted_out | INT | Permanent opt-out |
| opted_out_at | INT | Epoch ms |
| opted_out_channels | TEXT | `ALL` or JSON list |
| digital_literacy | TEXT | `LOW` \| `MEDIUM` \| `HIGH` |
| ltv_paise | INT | Sum of successful simulated payments |
| preferred_channel | TEXT | Hint for playbook selection |
| salary_credit_day | INT | 1–31, salary-cycle retries |
| fraud_flag / bankruptcy_flag | INT | Stopping-rule inputs |
| city | TEXT | Indian city |
| created_at | INT | Epoch ms |

### `subscriptions`

Recurring product. `amount_paise` is one cycle. `mandate_id` is a soft link (no circular FK).

### `mandates`

UPI Autopay / eNACH / card / netbanking instrument. `status` includes `REVOKED`, `EXPIRED`, `CAP_EXCEEDED`, `FAILED`. `break_reason` set when not healthy. `umn` is the unique mandate number. `last_pre_debit_notice_at` supports RBI 24h pre-debit checks.

### `payment_attempts`

Every simulated charge. `decline_category` is the six-bucket taxonomy (NSF / expired / issuer-soft / technical / mandate / hard-fraud). `in_outage_window` marks attempts inside the injected Razorpay×HDFC incident. `open_failure=1` means this is the latest attempt on its grouping key and it failed — a Surface A candidate (see seed report for surface accounting).

### `checkout_sessions`

`abandoned=1` sessions are Surface B. `drop_stage` + `drop_reason` drive diagnosis. `converted=1` sessions have a matching successful payment.

### `invoices`

B2B receivables. `ageing_bucket` is `0_30` / `31_60` / `61_90` / `90_PLUS` from due date vs batch as-of. `dispute_open` + `dispute_type` + `email_thread` / `dispute_notes` are the LLM residual for Step 3. Outstanding = `amount_paise - paid_paise`.

### `gateway_health`

Aggregated success rate per `(gateway, issuer, window)` at `HOUR` or `DAY` granularity. `success_rate_bps` is 0–10000. `is_degraded=1` on the injected incident windows. Derived from `payment_attempts` during seed so detector and facts agree.

---

## Agent state (empty after seed, except `audit_events`)

| Table | Role |
|---|---|
| `risk_items` | Unified leak object. Surfaces `A` payment fail, `B` checkout, `C` mandate, `D` invoice. `p_loss_bps` × `exposure_paise` × `urgency_bps` / 100000000 = `risk_score`. Cohort `TREATMENT` \| `HOLDOUT`. |
| `diagnoses` | Root cause, evidence JSON, `is_systemic`, optional LLM flag |
| `intervention_plans` | Chosen playbook, `ev_paise`, written rationale, skip flag |
| `plan_steps` | Ordered ladder. Unique `(plan_id, step_no)` |
| `gate_decisions` | Every allow *and* block from `gate()` |
| `communications` | Simulated outbound payloads; SMS carries DLT `template_id` |
| `promises_to_pay` | B2B PTP capture |
| `recoveries` | Actual (simulated) cash in. No ground-truth columns. |
| `audit_events` | Append-only hash chain. Triggers block UPDATE/DELETE. |
| `incidents` | Detector output. **Left empty by seed** so Step 2 must find the outage. |

### `audit_events` chain

`seq` is monotonic. `prev_hash` of seq=1 is 64 zero hex chars. `hash = sha256(prev_hash \| canonical(payload))`. `inputs_digest` hashes the decision inputs. `actor` is `AGENT` \| `HUMAN` \| `SYSTEM`.

---

## Simulator only

### `ground_truth` (per customer)

Latent pay propensity, channel affinity JSON (bps per channel, sums to 10000), time-decay half-life (hours), discount/price sensitivity, max tolerable contacts, `would_pay_anyway`, `latent_credit_day`.

### `ground_truth_events` (per leak)

`source_ref` matches a payment / checkout / mandate / invoice id. `true_root_cause` is the label for the Step 3 confusion matrix. Event-level `would_pay_anyway` and `hours_until_unassisted` drive the outcome resolver. Companion table because cause is per-event, not per-customer. **Same no-read rule as `ground_truth`.**

---

## Reference

### `dlt_templates`

TRAI DLT-registered templates. No `template_id` → no SMS send (Step 5).

### `sim_meta`

Key/value run config: seed, as-of, incident window, fingerprint.

---

## Decline taxonomy (assumption)

| Category | Share of *non-outage* failures | Codes |
|---|---|---|
| `INSUFFICIENT_FUNDS` | ~35% | `INSUFFICIENT_FUNDS`, `BANK_DECLINE_NSF` |
| `EXPIRED_CARD` | ~15% | `EXPIRED_CARD`, `INVALID_CARD`, `CARD_EXPIRED` |
| `ISSUER_SOFT` | ~20% | `ISSUER_DECLINED`, `DO_NOT_HONOUR`, `TRY_AGAIN_LATER`, `AUTHENTICATION_REQUIRED`, `OTP_DROPOFF` |
| `TECHNICAL` | ~15% | `GATEWAY_TIMEOUT`, `GATEWAY_ERROR`, `NETWORK_ERROR`, `ISSUER_UNAVAILABLE`, `BANK_DOWNTIME` |
| `MANDATE` | ~10% | `MANDATE_REVOKED`, `MANDATE_EXPIRED`, `DEBIT_CAP_EXCEEDED`, `PRE_DEBIT_NOTICE_FAILED`, `ACCOUNT_CLOSED` |
| `HARD_FRAUD` | ~5% | `FRAUD_SUSPECTED`, `STOLEN_CARD`, `LOST_CARD`, `PICKUP_CARD`, `BLOCKED_CARD` |

The injected outage adds extra `TECHNICAL` failures for Razorpay × HDFC and will skew the *overall* mix. The seed report prints both overall and ex-outage distributions.

---

## Surfaces and ₹ at risk (seed accounting)

| Surface | Risk-bearing event |
|---|---|
| A | `payment_attempts.open_failure=1` whose linked mandate is healthy or absent |
| B | `checkout_sessions.abandoned=1` |
| C | `mandates.status` in `REVOKED`, `EXPIRED`, `FAILED`, `CAP_EXCEEDED` |
| D | invoices with `status` in `PAST_DUE`, `DISPUTED`, `PARTIAL` and outstanding paise > 0 |

Failed charges that only exist because a mandate broke are attributed to C, not A, so the four surfaces do not double-count the same rupee.
