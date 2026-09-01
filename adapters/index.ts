export * from "./types";

import { formatEmail } from "./email";
import { formatGatewayCharge } from "./gateway";
import { formatSms } from "./sms";
import type { AdapterMessageInput, AdapterMessageOutput } from "./types";
import { formatVoiceTranscript } from "./voice";
import { formatWhatsApp } from "./whatsapp";
import { verifyGatePassport, type GatePassport } from "../engines/gate";

/**
 * Universal Mock Adapter Dispatcher Choke Point.
 *
 * NOTE ON EXPORTS:
 * Raw communication formatters (formatEmail, formatSms, formatWhatsApp, formatVoiceTranscript,
 * formatGatewayCharge) are intentionally NOT exported from this module.
 * The only public customer-facing dispatch interface in this codebase is dispatchMockAdapter(),
 * which strictly requires an HMAC-SHA256 GatePassport minted by engines/gate.ts.
 */
export function dispatchMockAdapter(
  input: AdapterMessageInput,
  passport?: GatePassport,
): AdapterMessageOutput {
  const channel = (
    (input.metadata?.channel as string) ??
    (input.action === "EXECUTE_VOICE_CALL" || input.action === "VOICE_CALL" ? "VOICE" : "EMAIL")
  ).toUpperCase();

  if (
    !verifyGatePassport(passport, {
      riskItemId: input.riskItemId,
      channel,
      action: input.action,
      planStepId: input.planStepId,
      now: input.scheduledAt,
    })
  ) {
    throw new Error(
      `SECURITY_ERROR: Gate invariant violation. Action '${input.action}' (planStep: '${input.planStepId ?? "none"}') on channel '${channel}' for risk item '${input.riskItemId}' rejected due to missing, tampered, or mismatched GatePassport.`,
    );
  }

  switch (channel) {
    case "SMS":
      return formatSms(input);
    case "WHATSAPP":
      return formatWhatsApp(input);
    case "VOICE":
      return formatVoiceTranscript(input);
    case "GATEWAY":
      return formatGatewayCharge(input);
    case "EMAIL":
    default:
      return formatEmail(input);
  }
}
