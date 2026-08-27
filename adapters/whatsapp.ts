import { formatInr } from "../src/money";
import { generatePaymentLink } from "./payment_link";
import type { AdapterMessageInput, AdapterMessageOutput } from "./types";

export function formatWhatsApp(input: AdapterMessageInput): AdapterMessageOutput {
  const link = generatePaymentLink(input.riskItemId, input.exposurePaise);
  const formattedAmount = formatInr(input.exposurePaise);

  let header = `*Payment Reminder*`;
  let body = `Hi ${input.customerName}, your payment of *${formattedAmount}* is currently due.`;
  let buttons = [
    { type: "URL", text: "Pay Now via UPI / Card", url: link },
    { type: "QUICK_REPLY", text: "Need Assistance" },
  ];

  if (input.language === "HI") {
    body = `नमस्ते ${input.customerName} जी, आपका *${formattedAmount}* का भुगतान बकाया है। नीचे दिए गए लिंक से तुरंत पूरा करें।`;
    buttons = [
      { type: "URL", text: "अभी भुगतान करें", url: link },
      { type: "QUICK_REPLY", text: "मदद चाहिए" },
    ];
  } else if (input.language === "HINGLISH") {
    body = `Namaste ${input.customerName} ji, aapka *${formattedAmount}* ka payment pending hai. Aap neeche diye link se UPI / Card se turant complete kar sakte hain.`;
    buttons = [
      { type: "URL", text: "Pay via UPI", url: link },
      { type: "QUICK_REPLY", text: "Call Me" },
    ];
  }

  if (input.playbook === "CART_RECOVERY") {
    header = `*Your Cart is Saved!*`;
    body = input.language === "HI"
      ? `नमस्ते ${input.customerName} जी, आपका कार्ट सुरक्षित है। अपनी खरीदारी पूरी करने के लिए यहाँ क्लिक करें:`
      : `Hi ${input.customerName}, we saved your cart items! Resume your order with one click here:`;
  }

  return {
    channel: "WHATSAPP",
    templateId: `wa_tpl_${input.playbook.toLowerCase()}_${input.language.toLowerCase()}`,
    payload: JSON.stringify({
      phone: input.phone,
      header,
      body,
      buttons,
      paymentUrl: link,
      language: input.language,
    }),
    metadata: { paymentUrl: link, language: input.language },
  };
}
