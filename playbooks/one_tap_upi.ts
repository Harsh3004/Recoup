import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;
const MINUTE = 60_000;

export const oneTapUpiPlaybook: PlaybookEvaluator = {
  name: "ONE_TAP_UPI",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return (
      (ctx.surface === "A" || ctx.surface === "B") &&
      (ctx.rootCause === "ISSUER_SOFT_DECLINE" ||
        ctx.rootCause === "OTP_DROPOFF" ||
        ctx.rootCause === "OTP_TIMEOUT" ||
        ctx.rootCause === "METHOD_ABSENT")
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    let pRecover = 7800; // UPI has highest conversion in India
    if (ctx.digitalLiteracy === "LOW") pRecover = 6800;

    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 90; // WhatsApp (80p) + Email (10p)
    const goodwillCost = 300; // ₹3.00 minimal friction
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `One-Tap UPI Intent Link: Lowest friction recovery path in India; ${pRecover / 100}% expected conversion; net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "WHATSAPP",
        action: "SEND_DYNAMIC_UPI_INTENT_LINK_AND_QR",
        scheduledAt: ctx.asOf + 30 * MINUTE,
        exitCriteria: "PAYMENT_SUCCESS",
      },
      {
        stepNo: 2,
        channel: "SMS",
        action: "SEND_DLT_UPI_RECOVERY_LINK",
        scheduledAt: ctx.asOf + 4 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS",
      },
    ];
  },
};
