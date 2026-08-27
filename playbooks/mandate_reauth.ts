import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const mandateReauthPlaybook: PlaybookEvaluator = {
  name: "MANDATE_REAUTH",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return (
      ctx.surface === "C" ||
      ctx.rootCause.startsWith("MANDATE") ||
      ctx.rootCause === "REVOKED" ||
      ctx.rootCause === "CAP_EXCEEDED" ||
      ctx.rootCause === "PRE_DEBIT_NOTICE_FAILED"
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    let pRecover = 6200;
    if (ctx.rootCause === "CAP_EXCEEDED") pRecover = 7500;
    else if (ctx.rootCause === "REVOKED") pRecover = 4500;

    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 115; // WhatsApp (80p) + SMS (25p) + Email (10p)
    const goodwillCost = 250; // ₹2.50
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `RBI-compliant e-mandate re-authorization: ${pRecover / 100}% re-auth probability; pre-debit notice compliant; net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "WHATSAPP",
        action: "SEND_RBI_PRE_DEBIT_AND_MANDATE_REAUTH_LINK",
        scheduledAt: ctx.asOf + 2 * HOUR,
        exitCriteria: "MANDATE_ACTIVE OR PAYMENT_SUCCESS",
      },
      {
        stepNo: 2,
        channel: "SMS",
        action: "SEND_DLT_MANDATE_EXPIRY_WARNING",
        scheduledAt: ctx.asOf + 24 * HOUR,
        exitCriteria: "MANDATE_ACTIVE OR PAYMENT_SUCCESS",
      },
      {
        stepNo: 3,
        channel: "EMAIL",
        action: "SEND_AUTOPAY_CONTINUITY_NOTICE",
        scheduledAt: ctx.asOf + 48 * HOUR,
        exitCriteria: "MANDATE_ACTIVE OR PAYMENT_SUCCESS",
      },
    ];
  },
};
