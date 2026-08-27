import { formatInr } from "../src/money";
import { DLT_ENTITY_ID } from "../src/sim/constants";
import { generatePaymentLink } from "./payment_link";
import type { AdapterMessageInput, AdapterMessageOutput } from "./types";

export function formatSms(input: AdapterMessageInput): AdapterMessageOutput {
  const link = generatePaymentLink(input.riskItemId, input.exposurePaise);
  const formattedAmount = formatInr(input.exposurePaise);

  let templateId = "dlt_sms_dunning_1";
  let body = `Dear ${input.customerName}, payment of ${formattedAmount} is pending. Pay now: ${link} - Recoup Fin`;

  if (input.playbook === "CARD_UPDATER") {
    templateId = "dlt_sms_card_update_1";
    body = `Dear ${input.customerName}, your card for autopay has expired. Update in 1 tap: ${link} - Recoup Fin`;
  } else if (input.playbook === "ONE_TAP_UPI") {
    templateId = "dlt_sms_upi_retry_1";
    body = `Dear ${input.customerName}, complete your ${formattedAmount} payment via UPI in 1 tap: ${link} - Recoup Fin`;
  }

  return {
    channel: "SMS",
    templateId,
    dltEntityId: DLT_ENTITY_ID,
    payload: JSON.stringify({
      phone: input.phone,
      dltEntityId: DLT_ENTITY_ID,
      templateId,
      text: body,
      paymentUrl: link,
    }),
    metadata: { dltEntityId: DLT_ENTITY_ID, templateId },
  };
}
