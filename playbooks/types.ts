/**
 * Playbook Engine Types
 */

export type PlaybookName =
  | "SMART_RETRY"
  | "CARD_UPDATER"
  | "MANDATE_REAUTH"
  | "ONE_TAP_UPI"
  | "DUNNING_LADDER"
  | "HINGLISH_VOICE"
  | "CART_RECOVERY"
  | "PARTIAL_PAYMENT"
  | "PROMISE_TO_PAY"
  | "DISCOUNT_WAIVER"
  | "HUMAN_ESCALATION"
  | "SYSTEMIC_SUPPRESSION"
  | "FRAUD_SUPPRESSION";

export type ChannelType = "GATEWAY" | "EMAIL" | "SMS" | "WHATSAPP" | "VOICE" | "PAYMENT_LINK" | "AGENT";

export interface PlaybookContext {
  riskItemId: string;
  surface: "A" | "B" | "C" | "D";
  customerId: string;
  customerName: string;
  segment: "B2C" | "SMB" | "ENTERPRISE";
  language: "EN" | "HI" | "HINGLISH";
  digitalLiteracy: "LOW" | "MEDIUM" | "HIGH";
  exposurePaise: number;
  rootCause: string;
  confidenceBps: number;
  isSystemic: boolean;
  salaryCreditDay: number | null;
  preferredChannel: ChannelType | null;
  dnd: boolean;
  optedOut: boolean;
  fraudFlag: boolean;
  bankruptcyFlag: boolean;
  ageingBucket?: string | null;
  dropStage?: string | null;
  asOf: number;
}

export interface EVBreakdown {
  pRecoverBps: number; // 0..10000
  grossExpectedPaise: number;
  channelCostPaise: number;
  goodwillCostPaise: number;
  discountCostPaise: number;
  netEvPaise: number;
  rationale: string;
}

export interface PlanStepSpec {
  stepNo: number;
  channel: ChannelType;
  action: string;
  scheduledAt: number;
  exitCriteria: string;
}

export interface PlaybookEvaluator {
  name: PlaybookName;
  isApplicable(ctx: PlaybookContext): boolean;
  computeEV(ctx: PlaybookContext): EVBreakdown;
  generateLadder(ctx: PlaybookContext): PlanStepSpec[];
}
