import { formatInr } from "../src/money";
import type { EVBreakdown, PlanStepSpec, PlaybookContext, PlaybookEvaluator } from "./types";

const HOUR = 3_600_000;

export const hinglishVoicePlaybook: PlaybookEvaluator = {
  name: "HINGLISH_VOICE",
  isApplicable(ctx: PlaybookContext): boolean {
    if (ctx.isSystemic || ctx.fraudFlag || ctx.bankruptcyFlag) return false;
    // Best for low digital literacy or Hindi/Hinglish preference with higher ticket value
    return (
      (ctx.language === "HINGLISH" || ctx.language === "HI" || ctx.digitalLiteracy === "LOW") &&
      ctx.exposurePaise >= 100_000 && // >= ₹1,000 to justify voice cost
      (ctx.surface === "A" || ctx.surface === "B" || ctx.surface === "C")
    );
  },
  computeEV(ctx: PlaybookContext): EVBreakdown {
    let pRecover = 7200;
    if (ctx.digitalLiteracy === "LOW") pRecover = 8000; // Humanized Hinglish voice bridges tech friction

    const gross = Number((BigInt(pRecover) * BigInt(ctx.exposurePaise)) / 10000n);
    const channelCost = 430; // Voice call (350p) + WhatsApp follow-up (80p)
    const goodwillCost = 2500; // ₹25.00 voice phone call goodwill impact
    const discountCost = 0;
    const net = gross - channelCost - goodwillCost - discountCost;

    return {
      pRecoverBps: pRecover,
      grossExpectedPaise: gross,
      channelCostPaise: channelCost,
      goodwillCostPaise: goodwillCost,
      discountCostPaise: discountCost,
      netEvPaise: net,
      rationale: `Hinglish Interactive Voice Call: High touch assistance for ${ctx.language} / low digital literacy customer; ${pRecover / 100}% conversion; net EV ${formatInr(net)}.`,
    };
  },
  generateLadder(ctx: PlaybookContext): PlanStepSpec[] {
    return [
      {
        stepNo: 1,
        channel: "VOICE",
        action: "EXECUTE_LLM_SCRIPTED_HINGLISH_VOICE_CALL",
        scheduledAt: ctx.asOf + 4 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR PROMISE_CAPTURED OR OPT_OUT",
      },
      {
        stepNo: 2,
        channel: "WHATSAPP",
        action: "SEND_VOICE_CALL_RECAP_AND_PAYMENT_LINK",
        scheduledAt: ctx.asOf + 6 * HOUR,
        exitCriteria: "PAYMENT_SUCCESS OR PROMISE_CAPTURED",
      },
    ];
  },
};
