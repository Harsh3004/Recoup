import { rupeesToPaise } from "../money";

export const DEFAULT_SEED = 42;

/** Demo "now": 20 Aug 2026 12:00 IST. */
export const AS_OF_ISO = "2026-08-20T12:00:00+05:30";

/** Injected systemic incident: Razorpay × HDFC, 6 hours. */
export const INCIDENT = {
  gateway: "razorpay",
  issuer: "HDFC",
  method: "CARD",
  startIso: "2026-08-19T10:00:00+05:30",
  endIso: "2026-08-19T16:00:00+05:30",
  kind: "GATEWAY_ISSUER_DEGRADATION",
} as const;

export const N_CUSTOMERS = 1200;

export const SEGMENT_COUNTS = {
  B2C: 900,
  SMB: 240,
  ENTERPRISE: 60,
} as const;

export const GATEWAYS = ["razorpay", "payu", "cashfree", "paytm"] as const;
export type Gateway = (typeof GATEWAYS)[number];

export const ISSUERS = [
  "HDFC",
  "ICICI",
  "SBI",
  "AXIS",
  "KOTAK",
  "YES",
  "PNB",
  "BOB",
  "INDUSIND",
  "IDFC",
] as const;
export type Issuer = (typeof ISSUERS)[number];

export const ISSUER_BINS: Record<Issuer, string> = {
  HDFC: "453212",
  ICICI: "411111",
  SBI: "524178",
  AXIS: "401288",
  KOTAK: "512345",
  YES: "400000",
  PNB: "508500",
  BOB: "356600",
  INDUSIND: "407383",
  IDFC: "601100",
};

export const CITIES = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Kochi",
  "Lucknow",
  "Indore",
  "Chandigarh",
  "Surat",
  "Nagpur",
] as const;

export const TIMEZONES = [
  ["Asia/Kolkata", 92],
  ["Asia/Dubai", 4],
  ["Europe/London", 2],
  ["America/New_York", 2],
] as const;

export const LANGUAGES = [
  ["EN", 40],
  ["HI", 25],
  ["HINGLISH", 35],
] as const;

export const SALARY_DAYS = [1, 2, 5, 7, 10, 15, 25, 28, 30] as const;

export const RECURRING_METHODS = [
  ["UPI_AUTOPAY", 45],
  ["ENACH", 25],
  ["CARD", 25],
  ["NETBANKING", 5],
] as const;

export const CHECKOUT_METHODS = [
  ["UPI", 55],
  ["CARD", 25],
  ["NETBANKING", 12],
  ["WALLET", 8],
] as const;

/**
 * Decline taxonomy for non-outage failures.
 * Weights match the plan: NSF 35 / expired 15 / issuer soft 20 / technical 15 / mandate 10 / hard 5.
 */
export const DECLINE_CATEGORY_WEIGHTS = [
  ["INSUFFICIENT_FUNDS", 35],
  ["EXPIRED_CARD", 15],
  ["ISSUER_SOFT", 20],
  ["TECHNICAL", 15],
  ["MANDATE", 10],
  ["HARD_FRAUD", 5],
] as const;

/** Random payment fails that are not a mandate-break event. Mandate share comes from broken mandates. */
export const NON_MANDATE_DECLINE_WEIGHTS = [
  ["INSUFFICIENT_FUNDS", 39],
  ["EXPIRED_CARD", 17],
  ["ISSUER_SOFT", 22],
  ["TECHNICAL", 17],
  ["HARD_FRAUD", 5],
] as const;

export type DeclineCategory =
  | "INSUFFICIENT_FUNDS"
  | "EXPIRED_CARD"
  | "ISSUER_SOFT"
  | "TECHNICAL"
  | "MANDATE"
  | "HARD_FRAUD";

export const DECLINE_CODES: Record<DeclineCategory, readonly string[]> = {
  INSUFFICIENT_FUNDS: ["INSUFFICIENT_FUNDS", "BANK_DECLINE_NSF"],
  EXPIRED_CARD: ["EXPIRED_CARD", "INVALID_CARD", "CARD_EXPIRED"],
  ISSUER_SOFT: [
    "ISSUER_DECLINED",
    "DO_NOT_HONOUR",
    "TRY_AGAIN_LATER",
    "AUTHENTICATION_REQUIRED",
    "OTP_DROPOFF",
  ],
  TECHNICAL: [
    "GATEWAY_TIMEOUT",
    "GATEWAY_ERROR",
    "NETWORK_ERROR",
    "ISSUER_UNAVAILABLE",
    "BANK_DOWNTIME",
  ],
  MANDATE: [
    "MANDATE_REVOKED",
    "MANDATE_EXPIRED",
    "DEBIT_CAP_EXCEEDED",
    "PRE_DEBIT_NOTICE_FAILED",
    "ACCOUNT_CLOSED",
  ],
  HARD_FRAUD: ["FRAUD_SUSPECTED", "STOLEN_CARD", "LOST_CARD", "PICKUP_CARD", "BLOCKED_CARD"],
};

export const OUTAGE_DECLINE_CODES = [
  "ISSUER_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "BANK_DOWNTIME",
  "NETWORK_ERROR",
] as const;

export const B2C_PLANS = [
  { name: "Starter", rupees: 99, cadence: "MONTHLY" as const },
  { name: "Plus", rupees: 199, cadence: "MONTHLY" as const },
  { name: "Pro", rupees: 499, cadence: "MONTHLY" as const },
  { name: "Business", rupees: 999, cadence: "MONTHLY" as const },
  { name: "Premium", rupees: 1499, cadence: "MONTHLY" as const },
] as const;

export const SMB_PLANS = [
  { name: "SMB Growth", rupees: 2999, cadence: "MONTHLY" as const },
  { name: "SMB Scale", rupees: 4999, cadence: "MONTHLY" as const },
  { name: "SMB Pro", rupees: 9999, cadence: "MONTHLY" as const },
] as const;

export const ENT_PLANS = [
  { name: "Enterprise Seat", rupees: 24999, cadence: "MONTHLY" as const },
  { name: "Enterprise Platform", rupees: 49999, cadence: "QUARTERLY" as const },
] as const;

export const CHECKOUT_RUPEES = [
  299, 499, 799, 999, 1299, 1499, 1999, 2499, 3999, 4999, 7999, 9999, 14999, 19999,
] as const;

export const SMB_INVOICE_RUPEES = [
  25000, 40000, 75000, 100000, 150000, 250000, 400000, 500000,
] as const;

export const ENT_INVOICE_RUPEES = [
  200000, 350000, 500000, 800000, 1200000, 2000000, 3500000, 5000000,
] as const;

export const DROP_STAGES = [
  ["CART", 10],
  ["SHIPPING", 22],
  ["PAYMENT_METHOD", 20],
  ["OTP", 28],
  ["REVIEW", 20],
] as const;

export const DROP_REASON_BY_STAGE: Record<string, readonly (readonly [string, number])[]> = {
  CART: [
    ["DISTRACTION", 50],
    ["PRICE_SHOCK", 35],
    ["TRUST_GAP", 15],
  ],
  SHIPPING: [
    ["SHIPPING_SHOCK", 55],
    ["PRICE_SHOCK", 25],
    ["DISTRACTION", 20],
  ],
  PAYMENT_METHOD: [
    ["METHOD_ABSENT", 50],
    ["FORM_FRICTION", 30],
    ["TRUST_GAP", 20],
  ],
  OTP: [
    ["OTP_TIMEOUT", 80],
    ["DISTRACTION", 20],
  ],
  REVIEW: [
    ["TRUST_GAP", 40],
    ["PRICE_SHOCK", 35],
    ["DISTRACTION", 25],
  ],
};

export const DISPUTE_TYPES = [
  ["PO_GRN_MISMATCH", 25],
  ["INVOICE_NOT_RECEIVED", 20],
  ["APPROVAL_STUCK", 20],
  ["LINE_ITEM_DISPUTE", 20],
  ["CASH_CRUNCH", 15],
] as const;

export const MANDATE_BREAK_REASONS = [
  ["REVOKED", 44],
  ["CAP_EXCEEDED", 22],
  ["EXPIRED", 17],
  ["ACCOUNT_CLOSED", 11],
  ["PRE_DEBIT_NOTICE_FAILED", 6],
] as const;

export const DLT_ENTITY_ID = "RECOUP_DLT_110001";

export const DLT_TEMPLATES = [
  {
    id: "110716000001",
    channel: "SMS" as const,
    purpose: "PAYMENT_RETRY_UPI",
    body: "Recoup: Your {plan} payment of {amount} failed. Pay in 1 tap: {link} - Recoup",
  },
  {
    id: "110716000002",
    channel: "SMS" as const,
    purpose: "CARD_UPDATE",
    body: "Recoup: Your card ending {last4} expired. Update securely: {link} - Recoup",
  },
  {
    id: "110716000003",
    channel: "SMS" as const,
    purpose: "PRE_DEBIT_NOTICE",
    body: "Recoup: We will debit {amount} for {plan} on {date} under mandate {umn}. - Recoup",
  },
  {
    id: "110716000004",
    channel: "SMS" as const,
    purpose: "INVOICE_REMINDER",
    body: "Recoup: Invoice {invoice_id} of {amount} is overdue. Pay: {link} - Recoup",
  },
  {
    id: "110716000005",
    channel: "WHATSAPP" as const,
    purpose: "CART_RECOVERY",
    body: "You left {item_count} item(s) worth {amount} in your cart. Complete checkout: {link}",
  },
  {
    id: "110716000006",
    channel: "EMAIL" as const,
    purpose: "DUNNING_SOFT",
    body: "We couldn't collect {amount} for {plan}. Here's a simple way to retry.",
  },
  {
    id: "110716000007",
    channel: "VOICE" as const,
    purpose: "HINGLISH_VOICE",
    body: "Namaste {name}, aapka {plan} payment fail ho gaya hai. Ek tap se pay kijiye.",
  },
] as const;

export const POLICY_VERSION = "policy-v0-seed";
export const MODEL_VERSION = "none";

export function planAmountPaise(plan: { rupees: number }): number {
  return rupeesToPaise(plan.rupees);
}
