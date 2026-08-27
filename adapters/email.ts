import { formatInr } from "../src/money";
import { generatePaymentLink } from "./payment_link";
import type { AdapterMessageInput, AdapterMessageOutput } from "./types";

export function formatEmail(input: AdapterMessageInput): AdapterMessageOutput {
  const link = generatePaymentLink(input.riskItemId, input.exposurePaise);
  const formattedAmount = formatInr(input.exposurePaise);

  let subject = `Payment Update regarding your account - ${formattedAmount}`;
  let body = "";

  if (input.playbook === "DUNNING_LADDER") {
    if (input.stepNo === 1) {
      subject = `Gentle reminder: Payment pending for your subscription (${formattedAmount})`;
      body = `Hi ${input.customerName},\n\nWe noticed that your recent payment of ${formattedAmount} did not go through. You can easily complete your payment using this secure link:\n\n${link}\n\nThank you,\nFinance & Collections Desk`;
    } else {
      subject = `Important: Action required on your overdue account (${formattedAmount})`;
      body = `Dear ${input.customerName},\n\nYour account has a pending balance of ${formattedAmount}. Please settle the outstanding amount to avoid service interruption:\n\n${link}\n\nRegards,\nAccounts Team`;
    }
  } else if (input.playbook === "CARD_UPDATER") {
    subject = `Update your payment card details securely`;
    body = `Hi ${input.customerName},\n\nYour saved card for recurring payments appears to have expired or declined. Update your card details in one click here:\n\n${link}\n\nBest regards,\nPayment Operations`;
  } else if (input.playbook === "PARTIAL_PAYMENT") {
    subject = `Instalment payment plan options for Invoice ${formattedAmount}`;
    body = `Dear ${input.customerName},\n\nWe understand cash flow timing can be tight. We are pleased to offer a structured 3-part instalment plan for your pending invoice of ${formattedAmount}.\n\nReview plan details here: ${link}\n\nRegards,\nFinance Team`;
  } else if (input.playbook === "PROMISE_TO_PAY") {
    subject = `Statement of Account & Payment Schedule Confirmation (${formattedAmount})`;
    body = `Dear ${input.customerName},\n\nAttached is your latest statement of account for ${formattedAmount}. Please confirm your expected payment date or complete payment online here:\n\n${link}\n\nWarm regards,\nCredit Control Team`;
  } else {
    subject = `Payment notification: ${formattedAmount}`;
    body = `Hi ${input.customerName},\n\nPlease complete your pending payment of ${formattedAmount} using this link: ${link}\n\nThank you!`;
  }

  return {
    channel: "EMAIL",
    templateId: `tpl_email_${input.playbook.toLowerCase()}_s${input.stepNo}`,
    subject,
    payload: JSON.stringify({
      to: input.email,
      recipientName: input.customerName,
      subject,
      body,
      paymentUrl: link,
      amount: formattedAmount,
    }),
    metadata: { paymentUrl: link },
  };
}
