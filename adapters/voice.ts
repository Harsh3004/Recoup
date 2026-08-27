import { formatInr } from "../src/money";
import { generatePaymentLink } from "./payment_link";
import type { AdapterMessageInput, AdapterMessageOutput } from "./types";

export function formatVoiceTranscript(input: AdapterMessageInput): AdapterMessageOutput {
  const link = generatePaymentLink(input.riskItemId, input.exposurePaise);
  const formattedAmount = formatInr(input.exposurePaise);

  let script: { speaker: string; text: string }[] = [];

  if (input.language === "HINGLISH" || input.language === "HI") {
    script = [
      {
        speaker: "AI_AGENT",
        text: `Namaste ${input.customerName} ji! Main Recoup support desk se bol raha hoon. Aapka ${formattedAmount} ka monthly subscription payment complete nahi ho paya tha.`,
      },
      {
        speaker: "CUSTOMER",
        text: `Haan, mera card sayad block ho gaya tha. Kaise pay karu?`,
      },
      {
        speaker: "AI_AGENT",
        text: `Koi baat nahi ji! Maine aapke WhatsApp pe ek instant UPI link bhej diya hai. Aap wahan se Google Pay ya PhonePe se 1 minute me complete kar sakte hain.`,
      },
      {
        speaker: "CUSTOMER",
        text: `Theek hai, main abhi check karke pay karta hoon. Shukriya.`,
      },
      {
        speaker: "AI_AGENT",
        text: `Dhanyawad ${input.customerName} ji! Have a wonderful day.`,
      },
    ];
  } else {
    script = [
      {
        speaker: "AI_AGENT",
        text: `Hello ${input.customerName}, this is the automated accounts desk calling regarding your pending transaction of ${formattedAmount}.`,
      },
      {
        speaker: "CUSTOMER",
        text: `Yes, I received an alert. Could you send me the payment link?`,
      },
      {
        speaker: "AI_AGENT",
        text: `Certainly! We have dispatched a secure payment link directly to your mobile number via SMS and WhatsApp.`,
      },
      {
        speaker: "CUSTOMER",
        text: `Great, I will clear the balance today. Thank you.`,
      },
    ];
  }

  return {
    channel: "VOICE",
    templateId: `voice_call_script_${input.language.toLowerCase()}`,
    payload: JSON.stringify({
      phone: input.phone,
      language: input.language,
      callDurationSeconds: 48,
      status: "COMPLETED",
      transcript: script,
      actionDispatched: "WHATSAPP_LINK_SENT",
      paymentUrl: link,
    }),
    metadata: { paymentUrl: link, callDurationSeconds: 48 },
  };
}
