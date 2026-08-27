import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const dunningLadderPlaybook: PlaybookEvaluator = {
  name: "DUNNING_LADDER",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return (
      (ctx.surface === "A" || ctx.surface === "C" || ctx.surface === "D") &&
      (ctx.rootCause === "ISSUER_SOFT_DECLINE" ||
        ctx.rootCause === "INVOICE_UNPAID" ||
        ctx.rootCause === "ACCOUNT_CLOSED")
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    let pRecover = 6500;
    if (ctx.segment === "ENTERPRISE") pRecover = 5800;

    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 465; // Email (10p) + SMS (25p) + WhatsApp (80p) + Voice (350p)
    const goodwillCost = 1500; // ₹15.00 graded tone ladder
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `Graded Dunning Ladder: Multi-channel progression (Email → SMS → WhatsApp → Voice) with polite escalations; net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "EMAIL",
        action: "SEND_POLITE_PAYMENT_REMINDER_EMAIL",
        scheduledAt: ctx.asOf + 2 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR DISPUTE_OPEN OR OPT_OUT",
      },
      {
        stepNo: 2,
        channel: "SMS",
        action: "SEND_DLT_URGENT_NOTICE_SMS",
        scheduledAt: ctx.asOf + 24 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR DISPUTE_OPEN OR OPT_OUT",
      },
      {
        stepNo: 3,
        channel: "WHATSAPP",
        action: "SEND_WHATSAPP_ACTION_SUMMARY_AND_LINK",
        scheduledAt: ctx.asOf + 48 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR DISPUTE_OPEN OR OPT_OUT",
      },
      {
        stepNo: 4,
        channel: "VOICE",
        action: "EXECUTE_AUTOMATED_IVR_REMINDER_CALL",
        scheduledAt: ctx.asOf + 72 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR DISPUTE_OPEN OR OPT_OUT",
      },
    ];
  },
};
