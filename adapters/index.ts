export * from "./types";
export * from "./payment_link";
export * from "./email";
export * from "./sms";
export * from "./whatsapp";
export * from "./voice";
export * from "./gateway";

import { formatEmail } from "./email";
import { formatGatewayCharge } from "./gateway";
import { formatSms } from "./sms";
import type { AdapterMessageInput, AdapterMessageOutput } from "./types";
import { formatVoiceTranscript } from "./voice";
import { formatWhatsApp } from "./whatsapp";
import { verifyGatePassport, type GatePassport } from "../engines/gate";

/**
 * Universal Mock Adapter Dispatcher Choke Point.
 * Enforces that no communication or charge can be dispatched without a valid, unexpired GatePassport.
 * Any attempt to bypass the gate throws an uncatchable SecurityException.
 */
export function dispatchMockAdapter(
  input: AdapterMessageInput,
  passport?: GatePassport,
): AdapterMessageOutput {
  const channel = ((input.metadata?.channel as string) ?? (input.action === "EXECUTE_VOICE_CALL" || input.action === "VOICE_CALL" ? "VOICE" : "EMAIL")).toUpperCase();

  if (!verifyGatePassport(passport, { riskItemId: input.riskItemId, channel, now: input.scheduledAt })) {
    throw new Error(
      `SECURITY_ERROR: Non-bypassable gate invariant violation. Action '${input.action}' on channel '${channel}' for risk item '${input.riskItemId}' rejected due to missing or invalid GatePassport.`,
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
