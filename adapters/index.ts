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

export function dispatchMockAdapter(input: AdapterMessageInput): AdapterMessageOutput {
  switch (input.action.includes("VOICE") || input.action.includes("CALL") ? "VOICE" : (input.metadata?.channel as string) ?? "EMAIL") {
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
