import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const cardUpdaterPlaybook: PlaybookEvaluator = {
  name: "CARD_UPDATER",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return ctx.rootCause === "EXPIRED_CARD" || ctx.rootCause === "INVALID_CARD";
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    let pRecover = 7000;
    if (ctx.segment === "B2C") pRecover = 7400;
    if (ctx.digitalLiteracy === "LOW") pRecover = 5000;

    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 105; // SMS (25p) + WhatsApp (80p)
    const goodwillCost = 200; // ₹2.00 low friction service notice
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `One-tap card update workflow: ${pRecover / 100}% expected conversion via instant update link; low goodwill friction; net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "WHATSAPP",
        action: "SEND_ONE_TAP_CARD_UPDATE_LINK",
        scheduledAt: ctx.asOf + 1 * HOUR,
        exitCriteria: "CARD_UPDATED OR PAYMENT_SUCCESS",
      },
      {
        stepNo: 2,
        channel: "SMS",
        action: "SEND_DLT_CARD_EXPIRY_SMS_REMINDER",
        scheduledAt: ctx.asOf + 24 * HOUR,
        exitCriteria: "CARD_UPDATED OR PAYMENT_SUCCESS",
      },
      {
        stepNo: 3,
        channel: "EMAIL",
        action: "SEND_SECURE_PAYMENT_INSTRUMENT_UPDATE_EMAIL",
        scheduledAt: ctx.asOf + 48 * HOUR,
        exitCriteria: "CARD_UPDATED OR PAYMENT_SUCCESS",
      },
    ];
  },
};
