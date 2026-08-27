import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;
const MINUTE = 60_000;

export const cartRecoveryPlaybook: PlaybookEvaluator = {
  name: "CART_RECOVERY",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return ctx.surface === "B";
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    let pRecover = 6000;
    let discountCost = 0;

    if (ctx.rootCause === "PRICE_SHOCK" || ctx.rootCause === "SHIPPING_SHOCK") {
      pRecover = 7200;
      discountCost = Math.round(ctx.exposurePaise * 0.05); // 5% coupon incentive
    } else if (ctx.rootCause === "DISTRACTION") {
      pRecover = 6500;
    }

    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 90; // WhatsApp (80p) + Email (10p)
    const goodwillCost = 500; // ₹5.00
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `Cart Recovery Engine: Contextual re-engagement for ${ctx.rootCause} with ${discountCost > 0 ? "5% coupon incentive" : "frictionless resume link"}; net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "WHATSAPP",
        action: "SEND_CART_RESUME_LINK_WITH_OFFER",
        scheduledAt: ctx.asOf + 45 * MINUTE,
        exitCriteria: "CHECKOUT_CONVERTED",
      },
      {
        stepNo: 2,
        channel: "EMAIL",
        action: "SEND_SAVED_BASKET_EMAIL_NUDGE",
        scheduledAt: ctx.asOf + 6 * HOUR,
        exitCriteria: "CHECKOUT_CONVERTED",
      },
    ];
  },
};
