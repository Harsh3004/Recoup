import { cardUpdaterPlaybook } from "./card_updater";
import { cartRecoveryPlaybook } from "./cart_recovery";
import { discountWaiverPlaybook } from "./discount_waiver";
import { dunningLadderPlaybook } from "./dunning_ladder";
import { hinglishVoicePlaybook } from "./hinglish_voice";
import { humanEscalationPlaybook } from "./human_escalation";
import { mandateReauthPlaybook } from "./mandate_reauth";
import { oneTapUpiPlaybook } from "./one_tap_upi";
import { partialPaymentPlaybook } from "./partial_payment";
import { promiseToPayPlaybook } from "./promise_to_pay";
import { smartRetryPlaybook } from "./smart_retry";
import type { PlaybookEvaluator } from "./types";

export * from "./types";

export const ALL_PLAYBOOKS: PlaybookEvaluator[] = [
  humanEscalationPlaybook,
  smartRetryPlaybook,
  cardUpdaterPlaybook,
  mandateReauthPlaybook,
  oneTapUpiPlaybook,
  hinglishVoicePlaybook,
  cartRecoveryPlaybook,
  discountWaiverPlaybook,
  partialPaymentPlaybook,
  promiseToPayPlaybook,
  dunningLadderPlaybook,
];
