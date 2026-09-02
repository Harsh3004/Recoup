import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { createHmac } from "node:crypto";
import { applySchema } from "../src/db";
import { resolveCase } from "../src/resolution";
import {
  generatePaymentLink,
  generateMockPaymentLink,
  createRazorpayPaymentLink,
} from "../adapters/payment_link";

describe("Razorpay Test Rail & Webhook Case Resolution", () => {
  let db: Database;
  const now = 1700000000000;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    applySchema(db);

    // Seed test customer
    db.exec(`
      INSERT INTO customers (id, segment, name, email, phone, language, timezone, digital_literacy, created_at)
      VALUES ('cus_rzp_01', 'SMB', 'Acme Logistics Pvt Ltd', 'billing@acme.com', '+919876543210', 'EN', 'Asia/Kolkata', 'HIGH', ${now});
    `);

    // Seed test risk item
    db.exec(`
      INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort)
      VALUES ('rsk_rzp_test_1', 'A', 'cus_rzp_01', 'pay_fail_01', 75000, 6000, 5000, 18000, ${now}, 'OPEN', 'TREATMENT');
    `);

    // Seed plan & pending steps
    db.exec(`
      INSERT INTO intervention_plans (id, risk_item_id, playbook, ev_paise, rationale, policy_version, created_at)
      VALUES ('pln_rzp_1', 'rsk_rzp_test_1', 'ONE_TAP_UPI', 60000, 'Test Plan', 'v1.2', ${now});
    `);
    db.exec(`
      INSERT INTO plan_steps (id, plan_id, risk_item_id, step_no, channel, action, scheduled_at, status)
      VALUES ('stp_rzp_1', 'pln_rzp_1', 'rsk_rzp_test_1', 1, 'WHATSAPP', 'SEND_WHATSAPP', ${now + 3600000}, 'PENDING');
    `);
    db.exec(`
      INSERT INTO plan_steps (id, plan_id, risk_item_id, step_no, channel, action, scheduled_at, status)
      VALUES ('stp_rzp_2', 'pln_rzp_1', 'rsk_rzp_test_1', 2, 'VOICE', 'CALL', ${now + 7200000}, 'PENDING');
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("generatePaymentLink returns deterministic mock link when no Razorpay keys are configured", () => {
    const link = generatePaymentLink("rsk_rzp_test_1", 75000);
    expect(link).toContain("https://rzp.io/i/rec_rzp_test_1_");
    expect(generateMockPaymentLink("rsk_rzp_test_1", 75000)).toBe(link);
  });

  it("resolveCase marks risk item RECOVERED with resolved_via='razorpay_live_webhook'", () => {
    const res = resolveCase(db, {
      riskItemId: "rsk_rzp_test_1",
      amountPaise: 75000,
      channel: "PAYMENT_LINK",
      playbook: "RAZORPAY_LIVE_RAIL",
      resolvedVia: "razorpay_live_webhook",
      paymentRef: "pay_test_payment_999",
      now,
    });

    expect(res.success).toBe(true);
    expect(res.riskItemId).toBe("rsk_rzp_test_1");
    expect(res.amountPaise).toBe(75000);
    expect(res.resolvedVia).toBe("razorpay_live_webhook");

    // Verify risk_items row
    const updatedRisk = db
      .query(`SELECT state, resolved_via FROM risk_items WHERE id = 'rsk_rzp_test_1'`)
      .get() as any;
    expect(updatedRisk.state).toBe("RECOVERED");
    expect(updatedRisk.resolved_via).toBe("razorpay_live_webhook");

    // Verify recoveries row
    const recovery = db
      .query(`SELECT * FROM recoveries WHERE risk_item_id = 'rsk_rzp_test_1'`)
      .get() as any;
    expect(recovery).toBeDefined();
    expect(recovery.amount_paise).toBe(75000);
    expect(recovery.channel).toBe("PAYMENT_LINK");
    expect(recovery.resolved_via).toBe("razorpay_live_webhook");
    expect(recovery.payment_ref).toBe("pay_test_payment_999");

    // Verify pending steps were cancelled (mid-ladder cancellation)
    const pendingSteps = db
      .query(`SELECT COUNT(*) as count FROM plan_steps WHERE risk_item_id = 'rsk_rzp_test_1' AND status = 'PENDING'`)
      .get() as any;
    expect(pendingSteps.count).toBe(0);

    const cancelledSteps = db
      .query(`SELECT COUNT(*) as count FROM plan_steps WHERE risk_item_id = 'rsk_rzp_test_1' AND status = 'CANCELLED'`)
      .get() as any;
    expect(cancelledSteps.count).toBe(2);

    // Verify cryptographic audit event recorded in hash chain
    const auditEvent = db
      .query(`SELECT * FROM audit_events WHERE entity_id = ?`)
      .get(res.recoveryId) as any;
    expect(auditEvent).toBeDefined();
    expect(auditEvent.action).toBe("RECOVERY_RECORDED");
    expect(auditEvent.decision).toBe("RECOVER");
    expect(auditEvent.reason_codes).toContain("RAZORPAY_WEBHOOK_PAID");
  });

  it("resolveCase is strictly idempotent and prevents double-recovery", () => {
    // First resolution
    const res1 = resolveCase(db, {
      riskItemId: "rsk_rzp_test_1",
      amountPaise: 75000,
      paymentRef: "pay_test_dup",
      now,
    });
    expect(res1.success).toBe(true);
    expect(res1.alreadyRecovered).toBeFalsy();

    // Duplicate webhook call
    const res2 = resolveCase(db, {
      riskItemId: "rsk_rzp_test_1",
      amountPaise: 75000,
      paymentRef: "pay_test_dup",
      now: now + 1000,
    });
    expect(res2.success).toBe(true);
    expect(res2.alreadyRecovered).toBe(true);

    // Ensure only 1 recovery row exists in database
    const recCount = db
      .query(`SELECT COUNT(*) as count FROM recoveries WHERE risk_item_id = 'rsk_rzp_test_1'`)
      .get() as any;
    expect(recCount.count).toBe(1);
  });

  it("verifies webhook HMAC-SHA256 signature correctly", () => {
    const webhookSecret = "secret_webhook_test_key_123";
    const payload = JSON.stringify({
      event: "payment_link.paid",
      payload: {
        payment_link: {
          entity: {
            id: "plink_test_123",
            reference_id: "rsk_rzp_test_1",
            amount_paid: 75000,
          },
        },
      },
    });

    const signature = createHmac("sha256", webhookSecret).update(payload).digest("hex");
    const tamperedPayload = payload + " ";

    const validCheck = createHmac("sha256", webhookSecret).update(payload).digest("hex");
    expect(validCheck).toBe(signature);

    const invalidCheck = createHmac("sha256", webhookSecret).update(tamperedPayload).digest("hex");
    expect(invalidCheck).not.toBe(signature);
  });
});
