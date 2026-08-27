import { createHash } from "node:crypto";
import { formatInr } from "../src/money";

export function generatePaymentLink(riskItemId: string, amountPaise: number): string {
  const hash = createHash("sha256")
    .update(`${riskItemId}:${amountPaise}:secret_salt`)
    .digest("hex")
    .slice(0, 10);
  return `https://rzp.io/i/rec_${riskItemId.replace("rsk_", "")}_${hash}`;
}
