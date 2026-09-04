import { beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { gate } from "../engines/gate";
import { createTestDb } from "./setup";

describe("Guardrails & Compliance Gate (Step 5)", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("enforces Quiet Hours by customer timezone for Voice (08:00–19:00)", () => {
    // 03:00 IST (Night)
    const nightTime = new Date("2026-08-20T03:00:00+05:30").getTime();
    // 14:00 IST (Day)
    const dayTime = new Date("2026-08-20T14:00:00+05:30").getTime();

    const nightDec = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        customerId: "cus_test_001",
        channel: "VOICE",
        action: "CALL",
        scheduledAt: nightTime,
      },
      { now: nightTime },
    );
    expect(nightDec.allowed).toBe(false);
    expect(nightDec.reasonCode).toBe("QUIET_HOURS_VOICE");

    const dayDec = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        customerId: "cus_test_001",
        channel: "VOICE",
        action: "CALL",
        scheduledAt: dayTime,
      },
      { now: dayTime },
    );
    expect(dayDec.allowed).toBe(true);
    expect(dayDec.reasonCode).toBe("ALLOWED");
  });

  it("enforces Quiet Hours by customer timezone for Commercial Comms (08:00–21:00)", () => {
    const lateNight = new Date("2026-08-20T23:30:00+05:30").getTime();
    const dec = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        customerId: "cus_test_001",
        channel: "WHATSAPP",
        action: "SEND_MESSAGE",
        scheduledAt: lateNight,
      },
      { now: lateNight },
    );
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("QUIET_HOURS_COMMERCIAL");
  });

  it("fires Stopping Rule: SYSTEMIC_INCIDENT during gateway degradation", () => {
    const dec = gate(db, {
      riskItemId: "rsk_test_outage",
      customerId: "cus_test_001",
      channel: "WHATSAPP",
      action: "SEND_MESSAGE",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("SYSTEMIC_INCIDENT");
  });

  it("fires Stopping Rule: FRAUD_OR_BANKRUPTCY_FLAG", () => {
    const dec = gate(db, {
      riskItemId: "rsk_test_001",
      customerId: "cus_test_fraud",
      channel: "SMS",
      action: "SEND_SMS",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("FRAUD_OR_BANKRUPTCY_FLAG");
  });

  it("fires Stopping Rule: OPTED_OUT", () => {
    const dec = gate(db, {
      riskItemId: "rsk_test_001",
      customerId: "cus_test_opted_out",
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("OPTED_OUT");
  });

  it("fires Stopping Rule: DISPUTE_OPEN", () => {
    const dec = gate(db, {
      riskItemId: "rsk_test_dispute",
      customerId: "cus_test_001",
      channel: "WHATSAPP",
      action: "SEND_MESSAGE",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("DISPUTE_OPEN");
  });

  it("fires Stopping Rule: PROMISE_TO_PAY_ACTIVE when active PTP exists", () => {
    const testRiskId = "rsk_test_ptp";
    db.query(
      `INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) 
       VALUES (?, 'A', 'cus_test_001', 'pay_test_ptp', 50000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`,
    ).run(testRiskId, Date.now());
    db.query(
      `INSERT INTO promises_to_pay (id, risk_item_id, customer_id, promised_amount_paise, promised_at, due_at, kept) 
       VALUES ('ptp_test', ?, 'cus_test_001', 50000, ?, ?, NULL)`,
    ).run(testRiskId, Date.now(), Date.now() + 86400000);

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_test_001",
      channel: "WHATSAPP",
      action: "SEND_MESSAGE",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("PROMISE_TO_PAY_ACTIVE");
  });

  it("fires Stopping Rule: PAID when risk item is recovered", () => {
    const testRiskId = "rsk_test_paid";
    db.query(
      `INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) 
       VALUES (?, 'A', 'cus_test_001', 'pay_test_paid', 10000, 5000, 5000, 2500, ?, 'RECOVERED', 'TREATMENT')`,
    ).run(testRiskId, Date.now());

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_test_001",
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("PAID");
  });

  it("fires Stopping Rule: MAX_ATTEMPTS_REACHED when communication threshold reached", () => {
    const testRiskId = "rsk_test_max";
    db.query(
      `INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) 
       VALUES (?, 'A', 'cus_test_001', 'pay_test_max', 10000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`,
    ).run(testRiskId, Date.now());
    for (let i = 1; i <= 4; i++) {
      db.query(
        `INSERT INTO communications (id, risk_item_id, customer_id, channel, status, sent_at) 
         VALUES (?, ?, 'cus_test_001', 'EMAIL', 'SENT', ?)`,
      ).run(`comm_test_${i}`, testRiskId, Date.now() - i * 3600000);
    }

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_test_001",
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("MAX_ATTEMPTS_REACHED");
  });

  it("fires Stopping Rule: HUMAN_TAKEOVER when case is escalated to account manager", () => {
    const testRiskId = "rsk_test_human";
    db.query(
      `INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) 
       VALUES (?, 'A', 'cus_test_001', 'pay_test_human', 10000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`,
    ).run(testRiskId, Date.now());
    db.query(
      `INSERT INTO intervention_plans (id, risk_item_id, playbook, ev_paise, rationale, skipped, policy_version, created_at) 
       VALUES ('pln_test_human', ?, 'HUMAN_ESCALATION', 100000, 'Human takeover', 0, 'v1', ?)`,
    ).run(testRiskId, Date.now());

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_test_001",
      channel: "SMS",
      action: "SEND_SMS",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("HUMAN_TAKEOVER");
  });

  it("fires Stopping Rule: NEGATIVE_EV when plan has negative EV", () => {
    const testRiskId = "rsk_test_negev";
    db.query(
      `INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) 
       VALUES (?, 'A', 'cus_test_001', 'pay_test_negev', 10000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`,
    ).run(testRiskId, Date.now());
    db.query(
      `INSERT INTO intervention_plans (id, risk_item_id, playbook, ev_paise, rationale, skipped, skip_reason, policy_version, created_at) 
       VALUES ('pln_test_negev', ?, 'DUNNING_LADDER', -500, 'Negative EV', 1, 'NEGATIVE_EV', 'v1', ?)`,
    ).run(testRiskId, Date.now());

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_test_001",
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("NEGATIVE_EV");
  });

  it("enforces RBI E-Mandate Rail: blocks debits > ₹15,000 without AFA step-up", () => {
    const testRiskId = "rsk_test_mandate_afa";
    const testMandateId = "man_test_afa";
    const now = Date.now();
    
    db.query(
      `INSERT INTO mandates (id, customer_id, method, status, debit_cap_paise, last_pre_debit_notice_at, created_at)
       VALUES (?, 'cus_test_001', 'UPI_AUTOPAY', 'ACTIVE', 2500000, ?, ?)`,
    ).run(testMandateId, now - 36 * 3600 * 1000, now);

    // Exposure ₹20,000 (20,00,000 paise) > ₹15,000 limit
    db.query(
      `INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort)
       VALUES (?, 'C', 'cus_test_001', ?, 2000000, 4500, 5000, 2250, ?, 'DETECTED', 'TREATMENT')`,
    ).run(testRiskId, testMandateId, now);

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_test_001",
      channel: "GATEWAY",
      action: "RETRY_DEBIT",
      scheduledAt: now,
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("RBI_AFA_STEPUP_REQUIRED");
    expect(dec.details).toContain("₹15,000");
  });

  it("enforces RBI E-Mandate Rail: blocks retry without 24-hour advance pre-debit notice", () => {
    const testRiskId = "rsk_test_mandate_notice";
    const testMandateId = "man_test_notice";
    const now = Date.now();
    
    // Notice sent only 4 hours ago (< 24h)
    db.query(
      `INSERT INTO mandates (id, customer_id, method, status, debit_cap_paise, last_pre_debit_notice_at, created_at)
       VALUES (?, 'cus_test_001', 'UPI_AUTOPAY', 'ACTIVE', 500000, ?, ?)`,
    ).run(testMandateId, now - 4 * 3600 * 1000, now);

    db.query(
      `INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort)
       VALUES (?, 'C', 'cus_test_001', ?, 500000, 4500, 5000, 2250, ?, 'DETECTED', 'TREATMENT')`,
    ).run(testRiskId, testMandateId, now);

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_test_001",
      channel: "GATEWAY",
      action: "RETRY_DEBIT",
      scheduledAt: now,
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("RBI_PRE_DEBIT_REQUIRED");
    expect(dec.details).toContain("24-hour");
  });
});
