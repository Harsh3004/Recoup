-- Recoup DDL
-- SQLite store, Postgres-compatible types/constraints.
-- Money: INTEGER paise. Never REAL. Currency INR.
-- ground_truth / ground_truth_events: simulator only. Engines MUST NOT read them.
-- Exception: engines/execute.ts outcome resolver (Step 6) is the sole reader.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Facts (the world)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
  id                 TEXT PRIMARY KEY,
  segment            TEXT NOT NULL CHECK (segment IN ('B2C', 'SMB', 'ENTERPRISE')),
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone              TEXT NOT NULL,
  language           TEXT NOT NULL CHECK (language IN ('EN', 'HI', 'HINGLISH')),
  timezone           TEXT NOT NULL,
  consent_email      INTEGER NOT NULL DEFAULT 1 CHECK (consent_email IN (0, 1)),
  consent_sms        INTEGER NOT NULL DEFAULT 1 CHECK (consent_sms IN (0, 1)),
  consent_whatsapp   INTEGER NOT NULL DEFAULT 1 CHECK (consent_whatsapp IN (0, 1)),
  consent_voice      INTEGER NOT NULL DEFAULT 0 CHECK (consent_voice IN (0, 1)),
  dnd                INTEGER NOT NULL DEFAULT 0 CHECK (dnd IN (0, 1)),
  opted_out          INTEGER NOT NULL DEFAULT 0 CHECK (opted_out IN (0, 1)),
  opted_out_at       INTEGER,
  opted_out_channels TEXT,
  digital_literacy   TEXT NOT NULL CHECK (digital_literacy IN ('LOW', 'MEDIUM', 'HIGH')),
  ltv_paise          INTEGER NOT NULL DEFAULT 0 CHECK (ltv_paise >= 0),
  preferred_channel  TEXT CHECK (preferred_channel IN ('EMAIL', 'SMS', 'WHATSAPP', 'VOICE', 'PAYMENT_LINK')),
  salary_credit_day  INTEGER CHECK (salary_credit_day BETWEEN 1 AND 31),
  fraud_flag         INTEGER NOT NULL DEFAULT 0 CHECK (fraud_flag IN (0, 1)),
  bankruptcy_flag    INTEGER NOT NULL DEFAULT 0 CHECK (bankruptcy_flag IN (0, 1)),
  city               TEXT,
  created_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id             TEXT PRIMARY KEY,
  customer_id    TEXT NOT NULL REFERENCES customers(id),
  plan_name      TEXT NOT NULL,
  amount_paise   INTEGER NOT NULL CHECK (amount_paise >= 0),
  cadence        TEXT NOT NULL CHECK (cadence IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  status         TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED')),
  mandate_id     TEXT,
  started_at     INTEGER NOT NULL,
  next_charge_at INTEGER,
  cancelled_at   INTEGER
);

CREATE TABLE IF NOT EXISTS mandates (
  id                       TEXT PRIMARY KEY,
  customer_id              TEXT NOT NULL REFERENCES customers(id),
  subscription_id          TEXT,
  method                   TEXT NOT NULL CHECK (method IN ('UPI_AUTOPAY', 'ENACH', 'CARD', 'NETBANKING')),
  status                   TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED', 'PAUSED', 'FAILED', 'CAP_EXCEEDED')),
  debit_cap_paise          INTEGER CHECK (debit_cap_paise IS NULL OR debit_cap_paise >= 0),
  issuer                   TEXT,
  gateway                  TEXT,
  bin                      TEXT,
  last4                    TEXT,
  expiry_month             INTEGER CHECK (expiry_month IS NULL OR expiry_month BETWEEN 1 AND 12),
  expiry_year              INTEGER,
  umn                      TEXT,
  break_reason             TEXT CHECK (break_reason IN (
                             'REVOKED', 'CAP_EXCEEDED', 'ACCOUNT_CLOSED',
                             'BANK_DOWNTIME', 'PRE_DEBIT_NOTICE_FAILED', 'EXPIRED'
                           )),
  revoked_at               INTEGER,
  last_pre_debit_notice_at INTEGER,
  created_at               INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT NOT NULL REFERENCES customers(id),
  subscription_id  TEXT,
  mandate_id       TEXT,
  invoice_id       TEXT,
  checkout_id      TEXT,
  amount_paise     INTEGER NOT NULL CHECK (amount_paise >= 0),
  method           TEXT NOT NULL,
  gateway          TEXT NOT NULL,
  issuer           TEXT,
  bin              TEXT,
  status           TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING', 'AUTHENTICATING')),
  decline_code     TEXT,
  decline_category TEXT CHECK (decline_category IN (
                     'INSUFFICIENT_FUNDS', 'EXPIRED_CARD', 'ISSUER_SOFT',
                     'TECHNICAL', 'MANDATE', 'HARD_FRAUD'
                   )),
  three_ds_dropped INTEGER NOT NULL DEFAULT 0 CHECK (three_ds_dropped IN (0, 1)),
  attempted_at     INTEGER NOT NULL,
  in_outage_window INTEGER NOT NULL DEFAULT 0 CHECK (in_outage_window IN (0, 1)),
  open_failure     INTEGER NOT NULL DEFAULT 0 CHECK (open_failure IN (0, 1))
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT REFERENCES customers(id),
  amount_paise     INTEGER NOT NULL CHECK (amount_paise >= 0),
  item_count       INTEGER NOT NULL DEFAULT 1 CHECK (item_count >= 0),
  device           TEXT NOT NULL CHECK (device IN ('MOBILE', 'DESKTOP', 'TABLET')),
  preferred_method TEXT,
  drop_stage       TEXT CHECK (drop_stage IN (
                     'BROWSE', 'CART', 'SHIPPING', 'PAYMENT_METHOD', 'OTP', 'REVIEW', 'SUCCESS'
                   )),
  drop_reason      TEXT CHECK (drop_reason IN (
                     'PRICE_SHOCK', 'SHIPPING_SHOCK', 'FORM_FRICTION', 'METHOD_ABSENT',
                     'OTP_TIMEOUT', 'TRUST_GAP', 'DISTRACTION'
                   )),
  started_at       INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  abandoned        INTEGER NOT NULL DEFAULT 0 CHECK (abandoned IN (0, 1)),
  converted        INTEGER NOT NULL DEFAULT 0 CHECK (converted IN (0, 1))
);

CREATE TABLE IF NOT EXISTS invoices (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT NOT NULL REFERENCES customers(id),
  amount_paise  INTEGER NOT NULL CHECK (amount_paise >= 0),
  paid_paise    INTEGER NOT NULL DEFAULT 0 CHECK (paid_paise >= 0),
  due_at        INTEGER NOT NULL,
  issued_at     INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('OPEN', 'PAST_DUE', 'PAID', 'DISPUTED', 'WRITTEN_OFF', 'PARTIAL')),
  ageing_bucket TEXT CHECK (ageing_bucket IN ('0_30', '31_60', '61_90', '90_PLUS')),
  po_number     TEXT,
  dispute_open  INTEGER NOT NULL DEFAULT 0 CHECK (dispute_open IN (0, 1)),
  dispute_type  TEXT CHECK (dispute_type IN (
                  'PO_GRN_MISMATCH', 'INVOICE_NOT_RECEIVED', 'APPROVAL_STUCK',
                  'LINE_ITEM_DISPUTE', 'CASH_CRUNCH'
                )),
  dispute_notes TEXT,
  email_thread  TEXT
);

CREATE TABLE IF NOT EXISTS gateway_health (
  id               TEXT PRIMARY KEY,
  gateway          TEXT NOT NULL,
  method           TEXT,
  issuer           TEXT,
  bin              TEXT,
  granularity      TEXT NOT NULL CHECK (granularity IN ('HOUR', 'DAY')),
  window_start     INTEGER NOT NULL,
  window_end       INTEGER NOT NULL,
  success_rate_bps INTEGER NOT NULL CHECK (success_rate_bps BETWEEN 0 AND 10000),
  attempt_count    INTEGER NOT NULL CHECK (attempt_count >= 0),
  success_count    INTEGER NOT NULL CHECK (success_count >= 0),
  is_degraded      INTEGER NOT NULL DEFAULT 0 CHECK (is_degraded IN (0, 1))
);

-- ---------------------------------------------------------------------------
-- Agent state (produced by later steps; empty after seed except audit)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS risk_items (
  id             TEXT PRIMARY KEY,
  surface        TEXT NOT NULL CHECK (surface IN ('A', 'B', 'C', 'D')),
  customer_id    TEXT NOT NULL REFERENCES customers(id),
  source_ref     TEXT NOT NULL,
  exposure_paise INTEGER NOT NULL CHECK (exposure_paise >= 0),
  p_loss_bps     INTEGER NOT NULL CHECK (p_loss_bps BETWEEN 0 AND 10000),
  urgency_bps    INTEGER NOT NULL CHECK (urgency_bps BETWEEN 0 AND 10000),
  -- risk_score = (p_loss_bps * exposure_paise * urgency_bps) / 100000000  (integer division)
  risk_score     INTEGER NOT NULL,
  first_seen_at  INTEGER NOT NULL,
  state          TEXT NOT NULL,
  cohort         TEXT NOT NULL CHECK (cohort IN ('TREATMENT', 'HOLDOUT')),
  incident_id    TEXT,
  UNIQUE (surface, source_ref)
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id             TEXT PRIMARY KEY,
  risk_item_id   TEXT NOT NULL REFERENCES risk_items(id),
  root_cause     TEXT NOT NULL,
  confidence_bps INTEGER NOT NULL CHECK (confidence_bps BETWEEN 0 AND 10000),
  is_systemic    INTEGER NOT NULL DEFAULT 0 CHECK (is_systemic IN (0, 1)),
  evidence_json  TEXT NOT NULL,
  decline_code   TEXT,
  llm_used       INTEGER NOT NULL DEFAULT 0 CHECK (llm_used IN (0, 1)),
  model_version  TEXT,
  diagnosed_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS intervention_plans (
  id             TEXT PRIMARY KEY,
  risk_item_id   TEXT NOT NULL REFERENCES risk_items(id),
  playbook       TEXT NOT NULL,
  ev_paise       INTEGER NOT NULL,
  rationale      TEXT NOT NULL,
  skipped        INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1)),
  skip_reason    TEXT,
  policy_version TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_steps (
  id            TEXT PRIMARY KEY,
  plan_id       TEXT NOT NULL REFERENCES intervention_plans(id),
  risk_item_id  TEXT NOT NULL,
  step_no       INTEGER NOT NULL,
  channel       TEXT NOT NULL,
  action        TEXT NOT NULL,
  scheduled_at  INTEGER NOT NULL,
  exit_criteria TEXT,
  status        TEXT NOT NULL CHECK (status IN ('PENDING', 'EXECUTED', 'CANCELLED', 'SKIPPED', 'BLOCKED')),
  executed_at   INTEGER,
  UNIQUE (plan_id, step_no)
);

CREATE TABLE IF NOT EXISTS gate_decisions (
  id           TEXT PRIMARY KEY,
  risk_item_id TEXT NOT NULL,
  plan_step_id TEXT,
  allowed      INTEGER NOT NULL CHECK (allowed IN (0, 1)),
  reason_code  TEXT NOT NULL,
  details      TEXT,
  decided_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS communications (
  id            TEXT PRIMARY KEY,
  risk_item_id  TEXT NOT NULL,
  plan_step_id  TEXT,
  customer_id   TEXT NOT NULL,
  channel       TEXT NOT NULL,
  template_id   TEXT,
  language      TEXT,
  payload       TEXT,
  sent_at       INTEGER,
  status        TEXT NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'FAILED', 'SUPPRESSED', 'SIMULATED')),
  dlt_entity_id TEXT
);

CREATE TABLE IF NOT EXISTS promises_to_pay (
  id                    TEXT PRIMARY KEY,
  risk_item_id          TEXT NOT NULL,
  customer_id           TEXT NOT NULL,
  promised_amount_paise INTEGER NOT NULL CHECK (promised_amount_paise >= 0),
  promised_at           INTEGER NOT NULL,
  due_at                INTEGER NOT NULL,
  kept                  INTEGER CHECK (kept IN (0, 1)),
  kept_at               INTEGER,
  notes                 TEXT
);

CREATE TABLE IF NOT EXISTS recoveries (
  id           TEXT PRIMARY KEY,
  risk_item_id TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  recovered_at INTEGER NOT NULL,
  channel      TEXT,
  playbook     TEXT,
  cohort       TEXT NOT NULL CHECK (cohort IN ('TREATMENT', 'HOLDOUT'))
);

CREATE TABLE IF NOT EXISTS audit_events (
  seq            INTEGER PRIMARY KEY,
  id             TEXT NOT NULL UNIQUE,
  prev_hash      TEXT NOT NULL,
  hash           TEXT NOT NULL,
  actor          TEXT NOT NULL CHECK (actor IN ('AGENT', 'HUMAN', 'SYSTEM')),
  action         TEXT NOT NULL,
  entity_type    TEXT,
  entity_id      TEXT,
  inputs_digest  TEXT,
  decision       TEXT,
  reason_codes   TEXT,
  policy_version TEXT,
  model_version  TEXT,
  ts             INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  gateway      TEXT,
  issuer       TEXT,
  method       TEXT,
  window_start INTEGER NOT NULL,
  window_end   INTEGER NOT NULL,
  detected_at  INTEGER,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  source       TEXT CHECK (source IN ('DETECTOR', 'MANUAL'))
);

-- ---------------------------------------------------------------------------
-- Simulator only. Engines except the Step 6 outcome resolver must not read.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ground_truth (
  customer_id                TEXT PRIMARY KEY REFERENCES customers(id),
  pay_propensity_bps         INTEGER NOT NULL CHECK (pay_propensity_bps BETWEEN 0 AND 10000),
  channel_affinity_json      TEXT NOT NULL,
  time_decay_halflife_hours  INTEGER NOT NULL CHECK (time_decay_halflife_hours > 0),
  discount_sensitivity_bps   INTEGER NOT NULL CHECK (discount_sensitivity_bps BETWEEN 0 AND 10000),
  price_sensitivity_bps      INTEGER NOT NULL CHECK (price_sensitivity_bps BETWEEN 0 AND 10000),
  max_tolerable_contacts     INTEGER NOT NULL CHECK (max_tolerable_contacts >= 0),
  would_pay_anyway           INTEGER NOT NULL CHECK (would_pay_anyway IN (0, 1)),
  latent_credit_day          INTEGER CHECK (latent_credit_day BETWEEN 1 AND 31)
);

CREATE TABLE IF NOT EXISTS ground_truth_events (
  source_ref              TEXT PRIMARY KEY,
  customer_id             TEXT NOT NULL REFERENCES customers(id),
  surface                 TEXT NOT NULL CHECK (surface IN ('A', 'B', 'C', 'D')),
  true_root_cause         TEXT NOT NULL,
  would_pay_anyway        INTEGER NOT NULL CHECK (would_pay_anyway IN (0, 1)),
  true_channel_json       TEXT,
  hours_until_unassisted  INTEGER,
  contact_fatigue_bps     INTEGER NOT NULL DEFAULT 0 CHECK (contact_fatigue_bps BETWEEN 0 AND 10000)
);

-- ---------------------------------------------------------------------------
-- Reference / run metadata
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dlt_templates (
  id            TEXT PRIMARY KEY,
  channel       TEXT NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP', 'EMAIL', 'VOICE')),
  purpose       TEXT NOT NULL,
  body          TEXT NOT NULL,
  registered    INTEGER NOT NULL DEFAULT 1 CHECK (registered IN (0, 1)),
  dlt_entity_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Append-only enforcement on the audit chain
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_mandates_customer ON mandates(customer_id);
CREATE INDEX IF NOT EXISTS idx_mandates_status ON mandates(status);
CREATE INDEX IF NOT EXISTS idx_pay_customer ON payment_attempts(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_attempted ON payment_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_pay_open ON payment_attempts(open_failure);
CREATE INDEX IF NOT EXISTS idx_pay_gw_issuer ON payment_attempts(gateway, issuer, attempted_at);
CREATE INDEX IF NOT EXISTS idx_pay_outage ON payment_attempts(in_outage_window);
CREATE INDEX IF NOT EXISTS idx_chk_abandoned ON checkout_sessions(abandoned);
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_inv_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_gh_window ON gateway_health(gateway, issuer, window_start);
CREATE INDEX IF NOT EXISTS idx_risk_customer ON risk_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_state ON risk_items(state);
CREATE INDEX IF NOT EXISTS idx_risk_cohort ON risk_items(cohort);
CREATE INDEX IF NOT EXISTS idx_diag_risk ON diagnoses(risk_item_id);
CREATE INDEX IF NOT EXISTS idx_plan_risk ON intervention_plans(risk_item_id);
CREATE INDEX IF NOT EXISTS idx_steps_plan ON plan_steps(plan_id, step_no);
CREATE INDEX IF NOT EXISTS idx_gate_risk ON gate_decisions(risk_item_id);
CREATE INDEX IF NOT EXISTS idx_comm_customer ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_events(ts);
CREATE INDEX IF NOT EXISTS idx_gte_customer ON ground_truth_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_gte_surface ON ground_truth_events(surface);
