import { Database } from "bun:sqlite";
import { appendAudit } from "./audit";

export interface ResolveCaseInput {
  riskItemId: string;
  amountPaise?: number;
  channel?: string;
  playbook?: string;
  resolvedVia?: string; // e.g. "razorpay_live_webhook" or "simulated"
  paymentRef?: string;  // e.g. "pay_29QQoUBi66xm2f"
  actor?: "AGENT" | "HUMAN" | "SYSTEM";
  reasonCode?: string;  // e.g. "RAZORPAY_WEBHOOK_PAID"
  now?: number;
}

export interface ResolveCaseResult {
  success: boolean;
  alreadyRecovered?: boolean;
  riskItemId: string;
  recoveryId?: string;
  amountPaise: number;
  resolvedVia: string;
  error?: string;
}

/**
 * Unified Case Resolution Function
 *
 * Authoritative case closure logic shared across simulation, human takeover,
 * and live Razorpay webhooks.
 *
 * 1. Verifies risk item existence and idempotency.
 * 2. Marks risk_item state = 'RECOVERED' and records resolved_via provenance.
 * 3. Records recovery transaction in recoveries table.
 * 4. Cancels remaining scheduled plan steps (mid-ladder cancellation).
 * 5. Cryptographically chains a RECOVERY_RECORDED block into the SHA-256 audit ledger.
 */
export function resolveCase(db: Database, input: ResolveCaseInput): ResolveCaseResult {
  const now = input.now ?? Date.now();
  const resolvedVia = input.resolvedVia ?? "razorpay_live_webhook";

  const risk = db
    .query(`SELECT id, customer_id, exposure_paise, state, cohort FROM risk_items WHERE id = ?`)
    .get(input.riskItemId) as {
      id: string;
      customer_id: string;
      exposure_paise: number;
      state: string;
      cohort: string;
    } | null;

  if (!risk) {
    return {
      success: false,
      riskItemId: input.riskItemId,
      amountPaise: input.amountPaise ?? 0,
      resolvedVia,
      error: `Risk item '${input.riskItemId}' not found.`,
    };
  }

  // Idempotency: if already recovered, avoid double counting
  if (risk.state === "RECOVERED") {
    return {
      success: true,
      alreadyRecovered: true,
      riskItemId: risk.id,
      amountPaise: input.amountPaise ?? risk.exposure_paise,
      resolvedVia,
    };
  }

  const amountPaise = input.amountPaise ?? risk.exposure_paise;
  const recId = input.paymentRef
    ? `rec_${input.paymentRef.replace(/[^a-zA-Z0-9_]/g, "")}`
    : `rec_live_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // 1. Insert into recoveries table
  try {
    db.prepare(`
      INSERT INTO recoveries (
        id, risk_item_id, customer_id, amount_paise, recovered_at,
        channel, playbook, cohort, resolved_via, payment_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recId,
      risk.id,
      risk.customer_id,
      amountPaise,
      now,
      input.channel ?? "PAYMENT_LINK",
      input.playbook ?? "RAZORPAY_LIVE_RAIL",
      risk.cohort ?? "TREATMENT",
      resolvedVia,
      input.paymentRef ?? null,
    );
  } catch (err: any) {
    // Fallback if schema doesn't have resolved_via or payment_ref yet
    db.prepare(`
      INSERT INTO recoveries (
        id, risk_item_id, customer_id, amount_paise, recovered_at,
        channel, playbook, cohort
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recId,
      risk.id,
      risk.customer_id,
      amountPaise,
      now,
      input.channel ?? "PAYMENT_LINK",
      input.playbook ?? "RAZORPAY_LIVE_RAIL",
      risk.cohort ?? "TREATMENT",
    );
  }

  // 2. Update risk_items state
  try {
    db.prepare(`
      UPDATE risk_items
      SET state = 'RECOVERED',
          resolved_via = ?
      WHERE id = ?
    `).run(resolvedVia, risk.id);
  } catch {
    db.prepare(`UPDATE risk_items SET state = 'RECOVERED' WHERE id = ?`).run(risk.id);
  }

  // 3. Cancel remaining scheduled steps
  db.prepare(`
    UPDATE plan_steps
    SET status = 'CANCELLED'
    WHERE risk_item_id = ? AND status = 'PENDING'
  `).run(risk.id);

  // 4. Cryptographic SHA-256 Audit Ledger Append
  appendAudit(db, {
    actor: input.actor ?? "SYSTEM",
    action: "RECOVERY_RECORDED",
    entityType: "recovery",
    entityId: recId,
    inputs: {
      riskItemId: risk.id,
      amountPaise,
      channel: input.channel ?? "PAYMENT_LINK",
      playbook: input.playbook ?? "RAZORPAY_LIVE_RAIL",
      resolvedVia,
      paymentRef: input.paymentRef ?? null,
    },
    decision: "RECOVER",
    reasonCodes: [input.reasonCode ?? "RAZORPAY_WEBHOOK_PAID"],
    policyVersion: "v1.2",
    modelVersion: "rzp_live_rail",
    ts: now,
  });

  return {
    success: true,
    riskItemId: risk.id,
    recoveryId: recId,
    amountPaise,
    resolvedVia,
  };
}
