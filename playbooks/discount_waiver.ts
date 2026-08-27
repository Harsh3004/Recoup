import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const discountWaiverPlaybook: PlaybookEvaluator = {
  name: "DISCOUNT_WAIVER",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    // Strictly for high value checkout or at-risk subscriptions where waiver saves high LTV
    return (
      (ctx.surface === "B" && ctx.rootCause === "PRICE_SHOCK" && ctx.exposurePaise >= 50_000) ||
      (ctx.surface === "C" && ctx.rootCause === "REVOKED" && ctx.exposurePaise >= 100_000)
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    const pRecover = 7600;
    const discountRate = 0.08; // 8% waiver
    const discountCost = Math.round(ctx.exposurePaise * discountRate);
    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 90; // Email (10p) + WhatsApp (80p)
    const goodwillCost = 5000; // ₹50.00
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `Targeted Retention Waiver (8%): Justified by high recovery lift (${pRecover / 100}%); cost ${formatInr(discountCost)}; positive net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "WHATSAPP",
        action: "SEND_EXCLUSIVE_LIMITED_TIME_WAIVER_LINK",
        scheduledAt: ctx.asOf + 2 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR CARD_UPDATED",
      },
      {
        stepNo: 2,
        channel: "EMAIL",
        action: "SEND_RETENTION_OFFER_FINAL_CHANCE",
        scheduledAt: ctx.asOf + 24 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR CARD_UPDATED",
      },
    ];
  },
};
