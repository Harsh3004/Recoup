import { describe, expect, it } from "bun:test";
import { openDb } from "../src/db";
import { gate, getLocalHour, type StoppingRule } from "../engines/gate";

describe("Guardrails & Compliance Gate (Step 5)", () => {
  const db = openDb();

  it("enforces Quiet Hours by customer timezone for Voice (08:00–19:00)", () => {
    const voiceCust = db.query(`SELECT id FROM customers WHERE consent_voice = 1 AND opted_out = 0 AND dnd = 0 LIMIT 1`).get() as { id: string };
    // 03:00 IST (Night)
    const nightTime = new Date("2026-08-20T03:00:00+05:30").getTime();
    // 14:00 IST (Day)
    const dayTime = new Date("2026-08-20T14:00:00+05:30").getTime();

    const nightDec = gate(db, {
      riskItemId: "rsk_A_000001",
      customerId: voiceCust.id,
      channel: "VOICE",
      action: "CALL",
      scheduledAt: nightTime,
    });
    expect(nightDec.allowed).toBe(false);
    expect(nightDec.reasonCode).toBe("QUIET_HOURS_VOICE");

    const dayDec = gate(db, {
      riskItemId: "rsk_A_000001",
      customerId: voiceCust.id,
      channel: "VOICE",
      action: "CALL",
      scheduledAt: dayTime,
    });
    expect(dayDec.allowed).toBe(true);
    expect(dayDec.reasonCode).toBe("ALLOWED");
  });

  it("enforces Quiet Hours by customer timezone for Commercial Comms (08:00–21:00)", () => {
    const lateNight = new Date("2026-08-20T23:30:00+05:30").getTime();
    const dec = gate(db, {
      riskItemId: "rsk_A_000001",
      customerId: "cus_000001",
      channel: "WHATSAPP",
      action: "SEND_MESSAGE",
      scheduledAt: lateNight,
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("QUIET_HOURS_COMMERCIAL");
  });

  it("fires Stopping Rule: SYSTEMIC_INCIDENT during gateway degradation", () => {
    const outageItem = db.query(`SELECT id, customer_id FROM risk_items WHERE incident_id IS NOT NULL LIMIT 1`).get() as { id: string; customer_id: string };
    const dec = gate(db, {
      riskItemId: outageItem.id,
      customerId: outageItem.customer_id,
      channel: "WHATSAPP",
      action: "SEND_MESSAGE",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("SYSTEMIC_INCIDENT");
  });

  it("fires Stopping Rule: FRAUD_OR_BANKRUPTCY_FLAG", () => {
    const fraudCust = db.query(`SELECT id FROM customers WHERE fraud_flag = 1 LIMIT 1`).get() as { id: string };
    const dec = gate(db, {
      riskItemId: "rsk_A_000001",
      customerId: fraudCust.id,
      channel: "SMS",
      action: "SEND_SMS",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("FRAUD_OR_BANKRUPTCY_FLAG");
  });

  it("fires Stopping Rule: OPTED_OUT", () => {
    const optCust = db.query(`SELECT id FROM customers WHERE opted_out = 1 LIMIT 1`).get() as { id: string };
    const dec = gate(db, {
      riskItemId: "rsk_A_000001",
      customerId: optCust.id,
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("OPTED_OUT");
  });

  it("fires Stopping Rule: DISPUTE_OPEN", () => {
    const dispItem = db.query(`
      SELECT r.id, r.customer_id FROM risk_items r
      JOIN invoices i ON i.id = r.source_ref
      JOIN customers c ON c.id = r.customer_id
      WHERE i.dispute_open = 1 AND c.opted_out = 0 AND c.dnd = 0 LIMIT 1
    `).get() as { id: string; customer_id: string };

    const dec = gate(db, {
      riskItemId: dispItem.id,
      customerId: dispItem.customer_id,
      channel: "WHATSAPP",
      action: "SEND_MESSAGE",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("DISPUTE_OPEN");
  });

  it("fires Stopping Rule: PROMISE_TO_PAY_ACTIVE when active PTP exists", () => {
    const testRiskId = "rsk_test_ptp";
    db.query(`INSERT OR REPLACE INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) VALUES (?, 'A', 'cus_000001', 'pay_test_ptp', 50000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`).run(testRiskId, Date.now());
    db.query(`INSERT OR REPLACE INTO promises_to_pay (id, risk_item_id, customer_id, promised_amount_paise, promised_at, due_at, kept) VALUES ('ptp_test', ?, 'cus_000001', 50000, ?, ?, NULL)`).run(testRiskId, Date.now(), Date.now() + 86400000);

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_000001",
      channel: "WHATSAPP",
      action: "SEND_MESSAGE",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("PROMISE_TO_PAY_ACTIVE");

    db.query(`DELETE FROM promises_to_pay WHERE id = 'ptp_test'`).run();
    db.query(`DELETE FROM risk_items WHERE id = ?`).run(testRiskId);
  });

  it("fires Stopping Rule: PAID when risk item is recovered", () => {
    const testRiskId = "rsk_test_paid";
    db.query(`INSERT OR REPLACE INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) VALUES (?, 'A', 'cus_000001', 'pay_test_paid', 10000, 5000, 5000, 2500, ?, 'RECOVERED', 'TREATMENT')`).run(testRiskId, Date.now());

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_000001",
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("PAID");

    db.query(`DELETE FROM risk_items WHERE id = ?`).run(testRiskId);
  });

  it("fires Stopping Rule: MAX_ATTEMPTS_REACHED when communication threshold reached", () => {
    const testRiskId = "rsk_test_max";
    db.query(`INSERT OR REPLACE INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) VALUES (?, 'A', 'cus_000001', 'pay_test_max', 10000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`).run(testRiskId, Date.now());
    for (let i = 1; i <= 4; i++) {
      db.query(`INSERT OR REPLACE INTO communications (id, risk_item_id, customer_id, channel, status, sent_at) VALUES (?, ?, 'cus_000001', 'EMAIL', 'SENT', ?)`).run(`comm_test_${i}`, testRiskId, Date.now() - i * 3600000);
    }

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_000001",
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("MAX_ATTEMPTS_REACHED");

    db.query(`DELETE FROM communications WHERE risk_item_id = ?`).run(testRiskId);
    db.query(`DELETE FROM risk_items WHERE id = ?`).run(testRiskId);
  });

  it("fires Stopping Rule: HUMAN_TAKEOVER when case is escalated to account manager", () => {
    const testRiskId = "rsk_test_human";
    db.query(`INSERT OR REPLACE INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) VALUES (?, 'A', 'cus_000001', 'pay_test_human', 10000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`).run(testRiskId, Date.now());
    db.query(`INSERT OR REPLACE INTO intervention_plans (id, risk_item_id, playbook, ev_paise, rationale, skipped, policy_version, created_at) VALUES ('pln_test_human', ?, 'HUMAN_ESCALATION', 100000, 'Human takeover', 0, 'v1', ?)`).run(testRiskId, Date.now());

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_000001",
      channel: "SMS",
      action: "SEND_SMS",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("HUMAN_TAKEOVER");

    db.query(`DELETE FROM intervention_plans WHERE id = 'pln_test_human'`).run();
    db.query(`DELETE FROM risk_items WHERE id = ?`).run(testRiskId);
  });

  it("fires Stopping Rule: NEGATIVE_EV when plan has negative EV", () => {
    const testRiskId = "rsk_test_negev";
    db.query(`INSERT OR REPLACE INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort) VALUES (?, 'A', 'cus_000001', 'pay_test_negev', 10000, 5000, 5000, 2500, ?, 'DETECTED', 'TREATMENT')`).run(testRiskId, Date.now());
    db.query(`INSERT OR REPLACE INTO intervention_plans (id, risk_item_id, playbook, ev_paise, rationale, skipped, skip_reason, policy_version, created_at) VALUES ('pln_test_negev', ?, 'DUNNING_LADDER', -500, 'Negative EV', 1, 'NEGATIVE_EV', 'v1', ?)`).run(testRiskId, Date.now());

    const dec = gate(db, {
      riskItemId: testRiskId,
      customerId: "cus_000001",
      channel: "EMAIL",
      action: "SEND_EMAIL",
      scheduledAt: Date.now(),
    });
    expect(dec.allowed).toBe(false);
    expect(dec.reasonCode).toBe("NEGATIVE_EV");

    db.query(`DELETE FROM intervention_plans WHERE id = 'pln_test_negev'`).run();
    db.query(`DELETE FROM risk_items WHERE id = ?`).run(testRiskId);
  });
});
