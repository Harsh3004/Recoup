import { pad } from "../src/sim/rng";
import type { AdapterMessageInput, AdapterMessageOutput, GatewayExecutionResult } from "./types";

export function formatGatewayCharge(input: AdapterMessageInput): AdapterMessageOutput {
  const chargeId = `chg_${pad(Math.floor(Math.random() * 1_000_000_000), 9)}`;
  return {
    channel: "GATEWAY",
    payload: JSON.stringify({
      chargeId,
      customerId: input.customerId,
      amountPaise: input.exposurePaise,
      scheduledAt: input.scheduledAt,
      action: "SMART_RETRY_CHARGE_EXECUTION",
    }),
    metadata: { chargeId },
  };
}
