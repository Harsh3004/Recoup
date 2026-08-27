import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;
const DAY = 86_400_000;

export const smartRetryPlaybook: PlaybookEvaluator = {
  name: "SMART_RETRY",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return (
      ctx.surface === "A" &&
      (ctx.rootCause === "INSUFFICIENT_FUNDS" || ctx.rootCause === "TECHNICAL_TRANSIENT")
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    let pRecover = 5500;
    if (ctx.rootCause === "TECHNICAL_TRANSIENT") pRecover = 7500;
    else if (ctx.salaryCreditDay) pRecover = 6800;

    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 50; // ₹0.50 gateway attempt fee
    const goodwillCost = 0; // Zero customer friction (invisible background retry)
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    const salText = ctx.salaryCreditDay
      ? `customer observed credit day is ${ctx.salaryCreditDay}th`
      : `standard optimal banking window`;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `Smart salary-cycle aware background retry: ${pRecover / 100}% recovery prob on ${salText}; zero customer goodwill cost; expected net value ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    const asOfDate = new Date(ctx.asOf);
    const currentDay = asOfDate.getUTCDate();
    const salDay = ctx.salaryCreditDay ?? 1;

    let targetTime = ctx.asOf + 6 * HOUR;
    if (ctx.rootCause === "INSUFFICIENT_FUNDS") {
      // If salary day is within 5 days ahead, schedule on salary day morning (09:30 UTC = 15:00 IST)
      if (salDay >= currentDay && salDay <= currentDay + 7) {
        const d = new Date(ctx.asOf);
        d.setUTCDate(salDay);
        d.setUTCHours(9, 30, 0, 0);
        targetTime = d.getTime();
      } else if (currentDay > 25 && salDay <= 5) {
        // Month end transition
        const d = new Date(ctx.asOf);
        d.setUTCMonth(d.getUTCMonth() + 1);
        d.setUTCDate(salDay);
        d.setUTCHours(9, 30, 0, 0);
        targetTime = d.getTime();
      } else {
        targetTime = ctx.asOf + 24 * HOUR;
      }
    }

    return [
      {
        stepNo: 1,
        channel: "GATEWAY",
        action: `EXECUTE_GATEWAY_RETRY (Salary-Cycle Calendar Scheduled)`,
        scheduledAt: targetTime,
        exitCriteria: "PAYMENT_SUCCESS OR MANDATE_REVOKED",
      },
    ];
  },
};
