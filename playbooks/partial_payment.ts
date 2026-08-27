import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const partialPaymentPlaybook: PlaybookEvaluator = {
  name: "PARTIAL_PAYMENT",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    return (
      ctx.rootCause === "CASH_CRUNCH" ||
      (ctx.surface === "D" && ctx.ageingBucket === "90_PLUS")
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    const pRecover = 7000; // Customer can pay in instalments vs 0 in full
    // Expected recovery across split instalments ~70% of full invoice
    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 90; // Email (10p) + WhatsApp (80p)
    const goodwillCost = 1000; // ₹10.00 preserving long-term relationship
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `Instalment & Partial Payment Agreement: Unlocks stalled receivables for cash-crunched account; preserves relationship; expected net ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "EMAIL",
        action: "PROPOSE_STRUCTURED_INSTALMENT_SCHEDULE",
        scheduledAt: ctx.asOf + 3 * HOUR,
        exitCriteria: "INSTALMENT_AGREED OR INVOICE_PAID",
      },
      {
        stepNo: 2,
        channel: "WHATSAPP",
        action: "SEND_PARTIAL_PAYMENT_INITIATION_LINK",
        scheduledAt: ctx.asOf + 24 * HOUR,
        exitCriteria: "INSTALMENT_AGREED OR INVOICE_PAID",
      },
    ];
  },
};
