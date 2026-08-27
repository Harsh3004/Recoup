import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const humanEscalationPlaybook: PlaybookEvaluator = {
  name: "HUMAN_ESCALATION",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    // For high value disputes, PO GRN mismatch, Line Item dispute, Enterprise past due > 60 days
    return (
      ctx.surface === "D" &&
      (ctx.rootCause === "PO_GRN_MISMATCH" ||
        ctx.rootCause === "LINE_ITEM_DISPUTE" ||
        (ctx.exposurePaise >= 10_000_000 && ctx.ageingBucket === "61_90"))
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    const pRecover = 8800; // Dedicated account manager resolution achieves high settlement rate
    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 15000; // ₹150.00 human desk operational cost
    const goodwillCost = 10000; // ₹100.00 high-touch human relationship handling
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `Human Collections Desk Handoff: Complex B2B invoice dispute (${ctx.rootCause}) requires account manager intervention with structured brief; net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "AGENT",
        action: "GENERATE_DISPUTE_BRIEF_AND_ASSIGN_ACCOUNT_MANAGER",
        scheduledAt: ctx.asOf + 1 * HOUR,
        exitCriteria: "DISPUTE_RESOLVED OR PAYMENT_SUCCESS",
      },
    ];
  },
};
