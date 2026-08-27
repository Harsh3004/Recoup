import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const promiseToPayPlaybook: PlaybookEvaluator = {
  name: "PROMISE_TO_PAY",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return (
      ctx.surface === "D" &&
      (ctx.rootCause === "INVOICE_UNPAID" ||
        ctx.rootCause === "APPROVAL_STUCK" ||
        ctx.rootCause === "INVOICE_NOT_RECEIVED")
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    const pRecover = 8200; // High kept rate once formal commitment is logged
    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 90; // Email (10p) + WhatsApp (80p)
    const goodwillCost = 1000; // ₹10.00
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `B2B Promise-to-Pay (PTP) Protocol: Captures binding payment commitment date with automated calendar tracking; expected net ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "EMAIL",
        action: "SEND_STATEMENT_AND_PTP_REGISTRATION_LINK",
        scheduledAt: ctx.asOf + 4 * HOUR,
        exitCriteria: "PROMISE_CAPTURED OR INVOICE_PAID",
      },
      {
        stepNo: 2,
        channel: "WHATSAPP",
        action: "SEND_AP_DESK_PTP_CONFIRMATION_REQUEST",
        scheduledAt: ctx.asOf + 48 * HOUR,
        exitCriteria: "PROMISE_CAPTURED OR INVOICE_PAID",
      },
    ];
  },
};
