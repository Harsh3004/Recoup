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
  remainingPaise: number;
  isFullyRecovered: boolean;
  resolvedVia: string;
  error?: string;
}

/**
 * Unified Case Resolution & Tranche Settlement Function
 *
 * Authoritative case recovery logic shared across simulation, human takeover,
 * and live Razorpay webhooks.
 *
 * 1. Verifies risk item existence and idempotency via paymentRef.
 * 2. If amount is partial:
 *    - Reduces risk_item exposure_paise by amount paid.
 *    - Sets state = 'PARTIALLY_RECOVERED' (or 'RECOVERED' if remaining balance is 0).
 * 3. Records recovery transaction in recoveries table with paymentRef.
 * 4. Cancels remaining scheduled plan steps only if fully recovered.
 * 5. Cryptographically chains a PARTIAL_PAYMENT_RECORDED or RECOVERY_RECORDED block into the SHA-256 audit ledger.
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
      remainingPaise: 0,
      isFullyRecovered: false,
      resolvedVia,
      error: `Risk item '${input.riskItemId}' not found.`,
    };
  }

  // Idempotency: prevent double recording if the exact same paymentRef was already recorded
  if (input.paymentRef) {
    const existingRec = db
      .query(`SELECT id, amount_paise FROM recoveries WHERE payment_ref = ? LIMIT 1`)
      .get(input.paymentRef) as { id: string; amount_paise: number } | null;
    if (existingRec) {
      return {
        success: true,
        alreadyRecovered: true,
        riskItemId: risk.id,
        recoveryId: existingRec.id,
        amountPaise: existingRec.amount_paise,
        remainingPaise: risk.exposure_paise,
        isFullyRecovered: risk.state === "RECOVERED",
        resolvedVia,
      };
    }
  }

  // Calculate tranche payment and remaining exposure balance
  const paymentAmountPaise = Math.max(0, input.amountPaise ?? risk.exposure_paise);
  const remainingPaise = Math.max(0, risk.exposure_paise - paymentAmountPaise);
  const isFullyRecovered = remainingPaise <= 0;
  const nextState = isFullyRecovered ? "RECOVERED" : "PARTIALLY_RECOVERED";

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
      paymentAmountPaise,
      now,
      input.channel ?? "PAYMENT_LINK",
      input.playbook ?? "RAZORPAY_LIVE_RAIL",
      risk.cohort ?? "TREATMENT",
      resolvedVia,
      input.paymentRef ?? null,
    );
  } catch (err: any) {
    db.prepare(`
      INSERT INTO recoveries (
        id, risk_item_id, customer_id, amount_paise, recovered_at,
        channel, playbook, cohort
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recId,
      risk.id,
      risk.customer_id,
      paymentAmountPaise,
      now,
      input.channel ?? "PAYMENT_LINK",
      input.playbook ?? "RAZORPAY_LIVE_RAIL",
      risk.cohort ?? "TREATMENT",
    );
  }

  // 2. Update risk_items: reduce exposure_paise by amount paid and set state
  try {
    db.prepare(`
      UPDATE risk_items
      SET exposure_paise = ?,
          state = ?,
          resolved_via = ?
      WHERE id = ?
    `).run(remainingPaise, nextState, resolvedVia, risk.id);
  } catch {
    db.prepare(`
      UPDATE risk_items
      SET exposure_paise = ?,
          state = ?
      WHERE id = ?
    `).run(remainingPaise, nextState, risk.id);
  }

  // 3. Cancel remaining scheduled steps ONLY if the entire invoice balance is fully cleared
  if (isFullyRecovered) {
    db.prepare(`
      UPDATE plan_steps
      SET status = 'CANCELLED'
      WHERE risk_item_id = ? AND status = 'PENDING'
    `).run(risk.id);
  }

  // 4. Cryptographic SHA-256 Audit Ledger Append
  appendAudit(db, {
    actor: input.actor ?? "SYSTEM",
    action: isFullyRecovered ? "RECOVERY_RECORDED" : "PARTIAL_PAYMENT_RECORDED",
    entityType: "recovery",
    entityId: recId,
    inputs: {
      riskItemId: risk.id,
      amountPaidPaise: paymentAmountPaise,
      remainingPaise,
      previousExposurePaise: risk.exposure_paise,
      isFullyRecovered,
      channel: input.channel ?? "PAYMENT_LINK",
      playbook: input.playbook ?? "RAZORPAY_LIVE_RAIL",
      resolvedVia,
      paymentRef: input.paymentRef ?? null,
    },
    decision: isFullyRecovered ? "RECOVER" : "PARTIAL_RECOVERY",
    reasonCodes: [input.reasonCode ?? (isFullyRecovered ? "RAZORPAY_WEBHOOK_PAID" : "RAZORPAY_TRANCHE_PAID")],
    policyVersion: "v1.2",
    modelVersion: "rzp_live_rail",
    ts: now,
  });

  return {
    success: true,
    riskItemId: risk.id,
    recoveryId: recId,
    amountPaise: paymentAmountPaise,
    remainingPaise,
    isFullyRecovered,
    resolvedVia,
  };
}
