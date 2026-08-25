#!/usr/bin/env bun
/**
 * Deterministic simulated economy.
 * Usage: bun run scripts/seed.ts [--seed 42] [--db data/recovery.db]
 *        bun run scripts/seed.ts --verify-repro
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { appendAudit } from "../src/audit";
import { applySchema, openDb, resetDbFile } from "../src/db";
import { assertPaise, formatInr, rupeesToPaise } from "../src/money";
import {
  AS_OF_ISO,
  B2C_PLANS,
  CHECKOUT_METHODS,
  CHECKOUT_RUPEES,
  CITIES,
  DECLINE_CATEGORY_WEIGHTS,
  DECLINE_CODES,
  NON_MANDATE_DECLINE_WEIGHTS,
  DEFAULT_SEED,
  DISPUTE_TYPES,
  DLT_ENTITY_ID,
  DLT_TEMPLATES,
  DROP_REASON_BY_STAGE,
  DROP_STAGES,
  ENT_INVOICE_RUPEES,
  ENT_PLANS,
  GATEWAYS,
  INCIDENT,
  ISSUER_BINS,
  ISSUERS,
  LANGUAGES,
  MANDATE_BREAK_REASONS,
  MODEL_VERSION,
  N_CUSTOMERS,
  OUTAGE_DECLINE_CODES,
  POLICY_VERSION,
  RECURRING_METHODS,
  SALARY_DAYS,
  SEGMENT_COUNTS,
  SMB_INVOICE_RUPEES,
  SMB_PLANS,
  TIMEZONES,
  type DeclineCategory,
  type Gateway,
  type Issuer,
} from "../src/sim/constants";
import { ENT_NAMES, FIRST_NAMES, LAST_NAMES, SMB_SUFFIXES, SMB_TRADE_NAMES } from "../src/sim/names";
import { pad, Rng } from "../src/sim/rng";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

type Segment = "B2C" | "SMB" | "ENTERPRISE";
type Channel = "EMAIL" | "SMS" | "WHATSAPP" | "VOICE" | "PAYMENT_LINK";

type CustomerRow = {
  id: string;
  segment: Segment;
  name: string;
  email: string;
  phone: string;
  language: string;
  timezone: string;
  consent_email: number;
  consent_sms: number;
  consent_whatsapp: number;
  consent_voice: number;
  dnd: number;
  opted_out: number;
  opted_out_at: number | null;
  opted_out_channels: string | null;
  digital_literacy: string;
  ltv_paise: number;
  preferred_channel: Channel;
  salary_credit_day: number;
  fraud_flag: number;
  bankruptcy_flag: number;
  city: string;
  created_at: number;
};

type MandateRow = {
  id: string;
  customer_id: string;
  subscription_id: string;
  method: string;
  status: string;
  debit_cap_paise: number;
  issuer: Issuer;
  gateway: Gateway;
  bin: string;
  last4: string;
  expiry_month: number | null;
  expiry_year: number | null;
  umn: string;
  break_reason: string | null;
  revoked_at: number | null;
  last_pre_debit_notice_at: number | null;
  created_at: number;
};

type SubRow = {
  id: string;
  customer_id: string;
  plan_name: string;
  amount_paise: number;
  cadence: "MONTHLY" | "QUARTERLY" | "YEARLY";
  status: string;
  mandate_id: string;
  started_at: number;
  next_charge_at: number;
  cancelled_at: number | null;
};

type PayRow = {
  id: string;
  customer_id: string;
  subscription_id: string | null;
  mandate_id: string | null;
  invoice_id: string | null;
  checkout_id: string | null;
  amount_paise: number;
  method: string;
  gateway: string;
  issuer: string;
  bin: string;
  status: "SUCCESS" | "FAILED";
  decline_code: string | null;
  decline_category: DeclineCategory | null;
  three_ds_dropped: number;
  attempted_at: number;
  in_outage_window: number;
  open_failure: number;
};

type CheckoutRow = {
  id: string;
  customer_id: string;
  amount_paise: number;
  item_count: number;
  device: "MOBILE" | "DESKTOP" | "TABLET";
  preferred_method: string;
  drop_stage: string | null;
  drop_reason: string | null;
  started_at: number;
  last_activity_at: number;
  abandoned: number;
  converted: number;
};

type InvoiceRow = {
  id: string;
  customer_id: string;
  amount_paise: number;
  paid_paise: number;
  due_at: number;
  issued_at: number;
  status: string;
  ageing_bucket: string | null;
  po_number: string | null;
  dispute_open: number;
  dispute_type: string | null;
  dispute_notes: string | null;
  email_thread: string | null;
};

function parseArgs(): { seed: number; dbPath: string; verify: boolean } {
  const args = process.argv.slice(2);
  let seed = DEFAULT_SEED;
  let dbPath = "data/recovery.db";
  let verify = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--seed") {
      seed = Number(args[++i]);
      if (!Number.isInteger(seed)) throw new Error(`--seed must be an integer`);
    } else if (a === "--db") {
      dbPath = String(args[++i]);
    } else if (a === "--verify-repro") {
      verify = true;
    }
  }
  return { seed, dbPath, verify };
}

function asOfMs(): number {
  return Date.parse(AS_OF_ISO);
}

function incidentWindow(): { start: number; end: number } {
  return { start: Date.parse(INCIDENT.startIso), end: Date.parse(INCIDENT.endIso) };
}

function inWindow(ts: number, start: number, end: number): boolean {
  return ts >= start && ts < end;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function ageingBucket(dueAt: number, asOf: number): string | null {
  const days = Math.trunc((asOf - dueAt) / DAY);
  if (days < 0) return null;
  if (days <= 30) return "0_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_PLUS";
}

function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.getTime();
}

function cadenceMonths(c: SubRow["cadence"]): number {
  if (c === "MONTHLY") return 1;
  if (c === "QUARTERLY") return 3;
  return 12;
}

function affinityJson(rng: Rng): string {
  const raw = [rng.int(8, 40), rng.int(8, 40), rng.int(8, 40), rng.int(4, 25), rng.int(8, 40)];
  const sum = raw.reduce((a, b) => a + b, 0);
  const bps = raw.map((x) => Math.trunc((x * 10000) / sum));
  let drift = 10000 - bps.reduce((a, b) => a + b, 0);
  bps[0] = (bps[0] ?? 0) + drift;
  const keys: Channel[] = ["EMAIL", "SMS", "WHATSAPP", "VOICE", "PAYMENT_LINK"];
  const obj: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) obj[keys[i]!] = bps[i]!;
  return JSON.stringify(obj);
}

function pickDecline(rng: Rng, category: DeclineCategory): { code: string; threeDs: number } {
  const code = rng.pick(DECLINE_CODES[category]);
  const threeDs = code === "OTP_DROPOFF" || code === "AUTHENTICATION_REQUIRED" ? 1 : 0;
  return { code, threeDs };
}

function trueCauseA(category: DeclineCategory, code: string, inOutage: number): string {
  if (inOutage === 1) return "SYSTEMIC_GATEWAY_OUTAGE";
  if (category === "INSUFFICIENT_FUNDS") return "INSUFFICIENT_FUNDS";
  if (category === "EXPIRED_CARD") return "EXPIRED_CARD";
  if (category === "ISSUER_SOFT") return code === "OTP_DROPOFF" ? "OTP_DROPOFF" : "ISSUER_SOFT_DECLINE";
  if (category === "TECHNICAL") return "TECHNICAL_TRANSIENT";
  if (category === "MANDATE") return code;
  return "FRAUD_OR_BLOCKED";
}

function emailThread(args: {
  name: string;
  invoiceId: string;
  amount: string;
  po: string;
  disputeType: string | null;
  language: string;
}): string {
  const { name, invoiceId, amount, po, disputeType, language } = args;
  if (disputeType === "PO_GRN_MISMATCH") {
    return [
      `From: ap@${slug(name)}.recoup.test`,
      `To: billing@merchant.recoup.test`,
      `Subject: Re: ${invoiceId} / PO ${po}`,
      ``,
      language === "EN"
        ? `Hi, GRN is not posted against PO ${po}. We cannot release ${amount} until stores confirms receipt. Please share delivery challan.`
        : `Namaste, PO ${po} ke against GRN pending hai. ${amount} hold pe hai jab tak stores confirm nahi karta.`,
    ].join("\n");
  }
  if (disputeType === "INVOICE_NOT_RECEIVED") {
    return [
      `From: ap@${slug(name)}.recoup.test`,
      `Subject: Invoice ${invoiceId}?`,
      ``,
      `We have no invoice in the AP inbox for ${amount}. Please re-send to ap@ and cc finance.`,
    ].join("\n");
  }
  if (disputeType === "APPROVAL_STUCK") {
    return [
      `From: ap@${slug(name)}.recoup.test`,
      `Subject: Re: ${invoiceId} approval`,
      ``,
      `Invoice ${invoiceId} (${amount}) is with the budget owner since last week. Not rejected — just stuck in queue.`,
    ].join("\n");
  }
  if (disputeType === "LINE_ITEM_DISPUTE") {
    return [
      `From: ap@${slug(name)}.recoup.test`,
      `Subject: Discrepancy on ${invoiceId}`,
      ``,
      `Line 3 (freight) does not match the PO ${po}. Holding the delta; rest can be paid once you issue a credit note.`,
    ].join("\n");
  }
  if (disputeType === "CASH_CRUNCH") {
    return [
      `From: cfo@${slug(name)}.recoup.test`,
      `Subject: Re: ${invoiceId} overdue`,
      ``,
      language === "EN"
        ? `We acknowledge ${invoiceId} for ${amount}. Collections from our retailers slipped this month. Can we split across two dates?`
        : `Invoice ${invoiceId} (${amount}) note kiya. Is mahine collections weak hain. Do dates mein split kar sakte hain?`,
    ].join("\n");
  }
  return [
    `From: ap@${slug(name)}.recoup.test`,
    `Subject: Re: ${invoiceId}`,
    ``,
    `Received. Scheduled in the next payment run.`,
  ].join("\n");
}

function fingerprint(db: Database): string {
  const tables = [
    "customers",
    "subscriptions",
    "mandates",
    "payment_attempts",
    "checkout_sessions",
    "invoices",
    "gateway_health",
    "ground_truth",
    "ground_truth_events",
    "dlt_templates",
  ];
  const parts: string[] = [];
  for (const t of tables) {
    const row = db.query(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number };
    parts.push(`${t}:${row.n}`);
  }
  const money = db
    .query(
      `SELECT
         (SELECT COALESCE(SUM(amount_paise),0) FROM payment_attempts) AS pay,
         (SELECT COALESCE(SUM(amount_paise),0) FROM checkout_sessions WHERE abandoned=1) AS chk,
         (SELECT COALESCE(SUM(amount_paise),0) FROM invoices) AS inv,
         (SELECT COALESCE(SUM(ltv_paise),0) FROM customers) AS ltv`,
    )
    .get() as { pay: number; chk: number; inv: number; ltv: number };
  parts.push(`pay_sum:${money.pay}`, `chk_sum:${money.chk}`, `inv_sum:${money.inv}`, `ltv:${money.ltv}`);
  const ids = db.query(`SELECT id FROM customers ORDER BY id`).all() as { id: string }[];
  const pays = db
    .query(`SELECT id, amount_paise, status, decline_code FROM payment_attempts ORDER BY id`)
    .all() as { id: string; amount_paise: number; status: string; decline_code: string | null }[];
  const blob =
    ids.map((r) => r.id).join(",") +
    "|" +
    pays.map((r) => `${r.id}:${r.amount_paise}:${r.status}:${r.decline_code ?? ""}`).join(",");
  parts.push(createHash("sha256").update(blob).digest("hex"));
  return parts.join("|");
}

function seedWorld(db: Database, seed: number): { report: string; fingerprint: string } {
  const rng = new Rng(seed);
  const asOf = asOfMs();
  const outage = incidentWindow();
  const now = asOf;

  const customers: CustomerRow[] = [];
  const subs: SubRow[] = [];
  const mandates: MandateRow[] = [];
  const pays: PayRow[] = [];
  const checkouts: CheckoutRow[] = [];
  const invoices: InvoiceRow[] = [];

  let paySeq = 0;
  const nextPayId = () => `pay_${pad(++paySeq, 6)}`;

  // --- customers ----------------------------------------------------------
  let entNameIdx = 0;
  for (let i = 1; i <= N_CUSTOMERS; i++) {
    let segment: Segment;
    if (i <= SEGMENT_COUNTS.B2C) segment = "B2C";
    else if (i <= SEGMENT_COUNTS.B2C + SEGMENT_COUNTS.SMB) segment = "SMB";
    else segment = "ENTERPRISE";

    const language = rng.weighted(LANGUAGES);
    const timezone = rng.weighted(TIMEZONES);
    const city = rng.pick(CITIES);
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);

    let name: string;
    if (segment === "B2C") name = `${first} ${last}`;
    else if (segment === "SMB") name = `${rng.pick(SMB_TRADE_NAMES)} ${rng.pick(SMB_SUFFIXES)} ${city}`;
    else {
      name = ENT_NAMES[entNameIdx % ENT_NAMES.length]!;
      entNameIdx++;
    }

    const id = `cus_${pad(i, 6)}`;
    const email =
      segment === "B2C"
        ? `${slug(first)}.${slug(last)}.${pad(i, 4)}@mail.recoup.test`
        : `ap.${pad(i, 4)}@${slug(name)}.corp.recoup.test`;

    const phone = `+91${rng.int(6, 9)}${pad(rng.int(0, 999999999), 9)}`;

    const digital_literacy =
      language === "HI"
        ? rng.weighted([
            ["LOW", 45],
            ["MEDIUM", 40],
            ["HIGH", 15],
          ] as const)
        : language === "HINGLISH"
          ? rng.weighted([
              ["LOW", 25],
              ["MEDIUM", 50],
              ["HIGH", 25],
            ] as const)
          : rng.weighted([
              ["LOW", 10],
              ["MEDIUM", 40],
              ["HIGH", 50],
            ] as const);

    const dnd = rng.bool(800) ? 1 : 0;
    const opted_out = rng.bool(300) ? 1 : 0;
    const fraud_flag = rng.bool(150) ? 1 : 0;
    const bankruptcy_flag = rng.bool(50) ? 1 : 0;

    const preferred_channel = rng.weighted([
      ["WHATSAPP", 35],
      ["SMS", 25],
      ["EMAIL", 20],
      ["PAYMENT_LINK", 12],
      ["VOICE", 8],
    ] as const) as Channel;

    customers.push({
      id,
      segment,
      name,
      email,
      phone,
      language,
      timezone,
      consent_email: rng.bool(9000) ? 1 : 0,
      consent_sms: dnd ? 0 : rng.bool(8500) ? 1 : 0,
      consent_whatsapp: rng.bool(8000) ? 1 : 0,
      consent_voice: rng.bool(4000) ? 1 : 0,
      dnd,
      opted_out,
      opted_out_at: opted_out ? asOf - rng.int(1, 40) * DAY : null,
      opted_out_channels: opted_out ? "ALL" : null,
      digital_literacy,
      ltv_paise: 0,
      preferred_channel,
      salary_credit_day: rng.pick(SALARY_DAYS),
      fraud_flag,
      bankruptcy_flag,
      city,
      created_at: asOf - rng.int(60, 800) * DAY,
    });
  }

  // Guarantee stopping-rule fixtures (at least one of each flag).
  if (!customers.some((c) => c.fraud_flag === 1)) customers[0]!.fraud_flag = 1;
  if (!customers.some((c) => c.bankruptcy_flag === 1)) customers[1]!.bankruptcy_flag = 1;
  if (!customers.some((c) => c.opted_out === 1)) {
    customers[2]!.opted_out = 1;
    customers[2]!.opted_out_at = asOf - 3 * DAY;
    customers[2]!.opted_out_channels = "ALL";
  }
  if (!customers.some((c) => c.dnd === 1)) customers[3]!.dnd = 1;

  const byId = new Map(customers.map((c) => [c.id, c]));
  const b2c = customers.filter((c) => c.segment === "B2C");
  const smb = customers.filter((c) => c.segment === "SMB");
  const ent = customers.filter((c) => c.segment === "ENTERPRISE");

  // --- subscriptions + mandates ------------------------------------------
  let subSeq = 0;
  let manSeq = 0;
  const brokenMandateIds: string[] = [];

  const maybeSubscribe = (c: CustomerRow, pBps: number, plans: readonly { name: string; rupees: number; cadence: "MONTHLY" | "QUARTERLY" | "YEARLY" }[]) => {
    if (!rng.bool(pBps)) return;
    const plan = rng.pick(plans);
    const amount_paise = rupeesToPaise(plan.rupees);
    const started_at = asOf - rng.int(90, 540) * DAY;
    const method = rng.weighted(RECURRING_METHODS);
    const issuer = rng.pick(ISSUERS);
    const gateway = rng.pick(GATEWAYS);
    const subId = `sub_${pad(++subSeq, 6)}`;
    const manId = `man_${pad(++manSeq, 6)}`;
    const capMult = rng.int(10, 30); // 1.0x–3.0x in tenths
    let debit_cap_paise = assertPaise(Math.trunc((amount_paise * capMult) / 10));
    const expiry_year = method === "CARD" ? rng.int(2025, 2029) : null;
    const expiry_month = method === "CARD" ? rng.int(1, 12) : null;

    let status = "ACTIVE";
    let break_reason: string | null = null;
    let revoked_at: number | null = null;
    let subStatus = "ACTIVE";

    // ~21% of mandates will be broken (tuned to ~180 of ~870).
    if (rng.bool(2100)) {
      break_reason = rng.weighted(MANDATE_BREAK_REASONS);
      if (break_reason === "REVOKED") {
        status = "REVOKED";
        revoked_at = asOf - rng.int(2, 25) * DAY;
      } else if (break_reason === "CAP_EXCEEDED") {
        status = "CAP_EXCEEDED";
        debit_cap_paise = amount_paise - rupeesToPaise(1);
        if (debit_cap_paise < 0) debit_cap_paise = 0;
      } else if (break_reason === "EXPIRED") {
        status = "EXPIRED";
      } else if (break_reason === "ACCOUNT_CLOSED") {
        status = "FAILED";
      } else {
        status = "FAILED";
      }
      subStatus = "PAST_DUE";
      brokenMandateIds.push(manId);
    }

    const lastNotice =
      method === "ENACH" || method === "UPI_AUTOPAY"
        ? asOf - rng.int(1, 10) * DAY
        : null;

    mandates.push({
      id: manId,
      customer_id: c.id,
      subscription_id: subId,
      method,
      status,
      debit_cap_paise,
      issuer,
      gateway,
      bin: ISSUER_BINS[issuer],
      last4: pad(rng.int(0, 9999), 4),
      expiry_month,
      expiry_year,
      umn: `UMN${pad(manSeq, 10)}`,
      break_reason,
      revoked_at,
      last_pre_debit_notice_at: lastNotice,
      created_at: started_at,
    });

    const months = cadenceMonths(plan.cadence);
    let next = started_at;
    while (next < asOf) next = addMonths(next, months);

    subs.push({
      id: subId,
      customer_id: c.id,
      plan_name: plan.name,
      amount_paise,
      cadence: plan.cadence,
      status: subStatus,
      mandate_id: manId,
      started_at,
      next_charge_at: next,
      cancelled_at: null,
    });
  };

  for (const c of b2c) maybeSubscribe(c, 8500, B2C_PLANS);
  for (const c of smb) maybeSubscribe(c, 4000, SMB_PLANS);
  for (const c of ent) maybeSubscribe(c, 2000, ENT_PLANS);

  const subById = new Map(subs.map((s) => [s.id, s]));
  const manById = new Map(mandates.map((m) => [m.id, m]));
  const manBySub = new Map(mandates.map((m) => [m.subscription_id, m]));

  // --- historical recurring charges --------------------------------------
  const openFailSubIds = new Set<string>();
  const healthySubs = subs.filter((s) => {
    const m = manBySub.get(s.id);
    return m && m.status === "ACTIVE";
  });
  const shuffledHealthy = rng.shuffle(healthySubs);
  const TARGET_A = 450;
  for (let i = 0; i < Math.min(TARGET_A, shuffledHealthy.length); i++) {
    openFailSubIds.add(shuffledHealthy[i]!.id);
  }

  for (const s of subs) {
    const m = manBySub.get(s.id)!;
    const months = cadenceMonths(s.cadence);
    let t = s.started_at;
    const charges: number[] = [];
    while (t < asOf - DAY) {
      charges.push(t);
      t = addMonths(t, months);
    }
    for (let ci = 0; ci < charges.length; ci++) {
      const attempted_at = charges[ci]! + rng.int(0, 8) * HOUR;
      const isLast = ci === charges.length - 1;
      const isBroken = m.status !== "ACTIVE";
      const forceOpenFail = isLast && openFailSubIds.has(s.id);
      const forceMandateFail = isLast && isBroken;

      let status: "SUCCESS" | "FAILED" = "SUCCESS";
      let decline_category: DeclineCategory | null = null;
      let decline_code: string | null = null;
      let three_ds = 0;
      let open_failure = 0;

      if (forceOpenFail) {
        status = "FAILED";
        decline_category = rng.weighted(NON_MANDATE_DECLINE_WEIGHTS) as DeclineCategory;
        const d = pickDecline(rng, decline_category);
        decline_code = d.code;
        three_ds = d.threeDs;
        open_failure = 1;
      } else if (forceMandateFail && rng.bool(8000)) {
        // ~80% of broken mandates also show a failed debit; the rest fail silently (surface C only).
        status = "FAILED";
        decline_category = "MANDATE";
        decline_code =
          m.break_reason === "REVOKED"
            ? "MANDATE_REVOKED"
            : m.break_reason === "CAP_EXCEEDED"
              ? "DEBIT_CAP_EXCEEDED"
              : m.break_reason === "EXPIRED"
                ? "MANDATE_EXPIRED"
                : m.break_reason === "PRE_DEBIT_NOTICE_FAILED"
                  ? "PRE_DEBIT_NOTICE_FAILED"
                  : "ACCOUNT_CLOSED";
        open_failure = 0; // attributed to surface C
      } else if (rng.bool(800)) {
        // historical fail-then-retry: a failed attempt, then we still record success as the cycle outcome
        const histCat = rng.weighted(NON_MANDATE_DECLINE_WEIGHTS) as DeclineCategory;
        const d = pickDecline(rng, histCat);
        pays.push({
          id: nextPayId(),
          customer_id: s.customer_id,
          subscription_id: s.id,
          mandate_id: m.id,
          invoice_id: null,
          checkout_id: null,
          amount_paise: s.amount_paise,
          method: m.method,
          gateway: m.gateway,
          issuer: m.issuer,
          bin: m.bin,
          status: "FAILED",
          decline_code: d.code,
          decline_category: histCat,
          three_ds_dropped: d.threeDs,
          attempted_at: attempted_at - rng.int(6, 36) * HOUR,
          in_outage_window: 0,
          open_failure: 0,
        });
      }

      const inOutage =
        inWindow(attempted_at, outage.start, outage.end) &&
        m.gateway === INCIDENT.gateway &&
        m.issuer === INCIDENT.issuer
          ? 1
          : 0;

      pays.push({
        id: nextPayId(),
        customer_id: s.customer_id,
        subscription_id: s.id,
        mandate_id: m.id,
        invoice_id: null,
        checkout_id: null,
        amount_paise: s.amount_paise,
        method: m.method,
        gateway: m.gateway,
        issuer: m.issuer,
        bin: m.bin,
        status,
        decline_code,
        decline_category,
        three_ds_dropped: three_ds,
        attempted_at,
        in_outage_window: inOutage,
        open_failure,
      });
    }
  }

  // --- organic one-shot traffic (baseline for detector) -------------------
  for (let i = 0; i < 3200; i++) {
    const c = rng.pick(customers);
    const issuer = rng.pick(ISSUERS);
    const gateway = rng.pick(GATEWAYS);
    const method = rng.weighted(CHECKOUT_METHODS);
    const amount_paise = rupeesToPaise(rng.pick(CHECKOUT_RUPEES));
    const attempted_at = asOf - rng.int(2, 60) * DAY - rng.int(0, 23) * HOUR;
    const inOutage =
      inWindow(attempted_at, outage.start, outage.end) &&
      gateway === INCIDENT.gateway &&
      issuer === INCIDENT.issuer
        ? 1
        : 0;
    let status: "SUCCESS" | "FAILED" = rng.bool(9000) ? "SUCCESS" : "FAILED";
    let decline_category: DeclineCategory | null = null;
    let decline_code: string | null = null;
    let three_ds = 0;
    if (inOutage === 1) {
      status = rng.bool(3500) ? "SUCCESS" : "FAILED";
      if (status === "FAILED") {
        decline_category = "TECHNICAL";
        decline_code = rng.pick(OUTAGE_DECLINE_CODES);
      }
    } else if (status === "FAILED") {
      decline_category = rng.weighted(NON_MANDATE_DECLINE_WEIGHTS) as DeclineCategory;
      const d = pickDecline(rng, decline_category);
      decline_code = d.code;
      three_ds = d.threeDs;
    }
    pays.push({
      id: nextPayId(),
      customer_id: c.id,
      subscription_id: null,
      mandate_id: null,
      invoice_id: null,
      checkout_id: null,
      amount_paise,
      method,
      gateway,
      issuer,
      bin: ISSUER_BINS[issuer],
      status,
      decline_code,
      decline_category,
      three_ds_dropped: three_ds,
      attempted_at,
      in_outage_window: inOutage,
      open_failure: 0,
    });
  }

  // --- injected outage burst: Razorpay × HDFC, 6 hourly windows ----------
  const hdfcCardHolders = mandates.filter((m) => m.issuer === INCIDENT.issuer);
  const outageVictims: PayRow[] = [];
  for (let h = 0; h < 6; h++) {
    const hourStart = outage.start + h * HOUR;
    const n = 20;
    for (let k = 0; k < n; k++) {
      const m =
        hdfcCardHolders.length > 0
          ? hdfcCardHolders[rng.int(0, hdfcCardHolders.length - 1)]!
          : rng.pick(mandates);
      const s = subById.get(m.subscription_id);
      const attempted_at = hourStart + rng.int(0, 55) * MINUTE;
      const fail = rng.bool(6500);
      const amount_paise = s ? s.amount_paise : rupeesToPaise(rng.pick(CHECKOUT_RUPEES));
      const row: PayRow = {
        id: nextPayId(),
        customer_id: m.customer_id,
        subscription_id: s ? s.id : null,
        mandate_id: m.id,
        invoice_id: null,
        checkout_id: null,
        amount_paise,
        method: m.method,
        gateway: INCIDENT.gateway,
        issuer: INCIDENT.issuer,
        bin: ISSUER_BINS[INCIDENT.issuer],
        status: fail ? "FAILED" : "SUCCESS",
        decline_code: fail ? rng.pick(OUTAGE_DECLINE_CODES) : null,
        decline_category: fail ? "TECHNICAL" : null,
        three_ds_dropped: 0,
        attempted_at,
        in_outage_window: 1,
        open_failure: 0,
      };
      pays.push(row);
      if (fail) outageVictims.push(row);
    }
  }

  // Mark a slice of outage failures as the customer's latest open failure
  // (no later success). Skip those already in openFailSubIds / broken mandates.
  const alreadyOpenCustomers = new Set(
    pays.filter((p) => p.open_failure === 1).map((p) => p.customer_id),
  );
  const brokenCustomers = new Set(mandates.filter((m) => m.status !== "ACTIVE").map((m) => m.customer_id));
  let outageOpen = 0;
  for (const p of rng.shuffle(outageVictims)) {
    if (outageOpen >= 80) break;
    if (alreadyOpenCustomers.has(p.customer_id)) continue;
    if (brokenCustomers.has(p.customer_id)) continue;
    p.open_failure = 1;
    alreadyOpenCustomers.add(p.customer_id);
    outageOpen++;
  }

  // --- checkouts ----------------------------------------------------------
  const TARGET_B_ABANDONED = 380;
  const TARGET_B_CONVERTED = 120;
  let chkSeq = 0;
  const b2cPool = rng.shuffle(b2c.slice());

  const makeCheckout = (abandoned: boolean, idx: number): CheckoutRow => {
    const c = b2cPool[idx % b2cPool.length]!;
    const amount_paise = rupeesToPaise(rng.pick(CHECKOUT_RUPEES));
    const started_at = asOf - rng.int(1, 12) * DAY - rng.int(0, 20) * HOUR;
    const device = rng.weighted([
      ["MOBILE", 70],
      ["DESKTOP", 25],
      ["TABLET", 5],
    ] as const) as CheckoutRow["device"];
    const preferred_method = rng.weighted(CHECKOUT_METHODS);
    if (abandoned) {
      const drop_stage = rng.weighted(DROP_STAGES);
      const reasons = DROP_REASON_BY_STAGE[drop_stage] ?? DROP_REASON_BY_STAGE["REVIEW"]!;
      const drop_reason = rng.weighted(reasons);
      return {
        id: `chk_${pad(++chkSeq, 6)}`,
        customer_id: c.id,
        amount_paise,
        item_count: rng.int(1, 6),
        device,
        preferred_method,
        drop_stage,
        drop_reason,
        started_at,
        last_activity_at: started_at + rng.int(3, 40) * MINUTE,
        abandoned: 1,
        converted: 0,
      };
    }
    const convertedAt = started_at + rng.int(4, 25) * MINUTE;
    const id = `chk_${pad(++chkSeq, 6)}`;
    const issuer = rng.pick(ISSUERS);
    const gateway = rng.pick(GATEWAYS);
    pays.push({
      id: nextPayId(),
      customer_id: c.id,
      subscription_id: null,
      mandate_id: null,
      invoice_id: null,
      checkout_id: id,
      amount_paise,
      method: preferred_method,
      gateway,
      issuer,
      bin: ISSUER_BINS[issuer],
      status: "SUCCESS",
      decline_code: null,
      decline_category: null,
      three_ds_dropped: 0,
      attempted_at: convertedAt,
      in_outage_window: 0,
      open_failure: 0,
    });
    return {
      id,
      customer_id: c.id,
      amount_paise,
      item_count: rng.int(1, 6),
      device,
      preferred_method,
      drop_stage: "SUCCESS",
      drop_reason: null,
      started_at,
      last_activity_at: convertedAt,
      abandoned: 0,
      converted: 1,
    };
  };

  for (let i = 0; i < TARGET_B_ABANDONED; i++) checkouts.push(makeCheckout(true, i));
  for (let i = 0; i < TARGET_B_CONVERTED; i++) checkouts.push(makeCheckout(false, i + TARGET_B_ABANDONED));

  // --- invoices -----------------------------------------------------------
  let invSeq = 0;
  const addInvoice = (
    c: CustomerRow,
    rupees: number,
    overdue: boolean,
    dispute: boolean,
    ageingTarget: string | null,
  ) => {
    const amount_paise = rupeesToPaise(rupees);
    const id = `inv_${pad(++invSeq, 6)}`;
    const po = `PO-${pad(invSeq, 5)}`;
    let due_at: number;
    if (!overdue) {
      due_at = asOf + rng.int(5, 25) * DAY;
    } else if (ageingTarget === "0_30") due_at = asOf - rng.int(1, 30) * DAY;
    else if (ageingTarget === "31_60") due_at = asOf - rng.int(31, 60) * DAY;
    else if (ageingTarget === "61_90") due_at = asOf - rng.int(61, 90) * DAY;
    else if (ageingTarget === "90_PLUS") due_at = asOf - rng.int(91, 180) * DAY;
    else due_at = asOf - rng.int(1, 45) * DAY;
    const issued_at = due_at - rng.int(7, 21) * DAY;
    const bucket = ageingBucket(due_at, asOf);
    let paid_paise = 0;
    let status: string;
    let dispute_type: string | null = null;
    if (!overdue) {
      status = rng.bool(4000) ? "PAID" : "OPEN";
      if (status === "PAID") paid_paise = amount_paise;
    } else if (dispute) {
      status = "DISPUTED";
      dispute_type = rng.weighted(DISPUTE_TYPES);
    } else if (rng.bool(1200)) {
      status = "PARTIAL";
      const pct = rng.int(20, 70);
      paid_paise = assertPaise(Math.trunc((amount_paise * pct) / 100));
    } else {
      status = "PAST_DUE";
    }
    invoices.push({
      id,
      customer_id: c.id,
      amount_paise,
      paid_paise,
      due_at,
      issued_at,
      status,
      ageing_bucket: bucket,
      po_number: po,
      dispute_open: dispute ? 1 : 0,
      dispute_type,
      dispute_notes: dispute_type
        ? `${dispute_type} on ${id}; PO ${po}; outstanding ${formatInr(amount_paise - paid_paise)}`
        : null,
      email_thread: emailThread({
        name: c.name,
        invoiceId: id,
        amount: formatInr(amount_paise),
        po,
        disputeType: dispute_type ?? (overdue ? "CASH_CRUNCH" : null),
        language: c.language,
      }),
    });
  };

  const ageingWeights = [
    ["0_30", 40],
    ["31_60", 30],
    ["61_90", 20],
    ["90_PLUS", 10],
  ] as const;

  for (const c of smb) {
    const n = rng.int(0, 2);
    for (let k = 0; k < n; k++) {
      const overdue = rng.bool(8000);
      addInvoice(c, rng.pick(SMB_INVOICE_RUPEES), overdue, overdue && rng.bool(1800), overdue ? rng.weighted(ageingWeights) : null);
    }
  }
  for (const c of ent) {
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const overdue = rng.bool(7500);
      addInvoice(c, rng.pick(ENT_INVOICE_RUPEES), overdue, overdue && rng.bool(2200), overdue ? rng.weighted(ageingWeights) : null);
    }
  }

  // Guarantee a handful of disputes if RNG undershot.
  const disputed = invoices.filter((i) => i.dispute_open === 1);
  if (disputed.length < 20) {
    for (const inv of invoices) {
      if (disputed.length >= 20) break;
      if (inv.status === "PAST_DUE" && inv.dispute_open === 0) {
        inv.status = "DISPUTED";
        inv.dispute_open = 1;
        inv.dispute_type = rng.weighted(DISPUTE_TYPES);
        inv.dispute_notes = `${inv.dispute_type} on ${inv.id}`;
        disputed.push(inv);
      }
    }
  }

  // --- persist ------------------------------------------------------------
  const insertCustomer = db.prepare(
    `INSERT INTO customers (
       id, segment, name, email, phone, language, timezone,
       consent_email, consent_sms, consent_whatsapp, consent_voice,
       dnd, opted_out, opted_out_at, opted_out_channels, digital_literacy,
       ltv_paise, preferred_channel, salary_credit_day, fraud_flag, bankruptcy_flag,
       city, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertSub = db.prepare(
    `INSERT INTO subscriptions (
       id, customer_id, plan_name, amount_paise, cadence, status, mandate_id,
       started_at, next_charge_at, cancelled_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertMan = db.prepare(
    `INSERT INTO mandates (
       id, customer_id, subscription_id, method, status, debit_cap_paise, issuer, gateway,
       bin, last4, expiry_month, expiry_year, umn, break_reason, revoked_at,
       last_pre_debit_notice_at, created_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertPay = db.prepare(
    `INSERT INTO payment_attempts (
       id, customer_id, subscription_id, mandate_id, invoice_id, checkout_id,
       amount_paise, method, gateway, issuer, bin, status, decline_code, decline_category,
       three_ds_dropped, attempted_at, in_outage_window, open_failure
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertChk = db.prepare(
    `INSERT INTO checkout_sessions (
       id, customer_id, amount_paise, item_count, device, preferred_method,
       drop_stage, drop_reason, started_at, last_activity_at, abandoned, converted
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertInv = db.prepare(
    `INSERT INTO invoices (
       id, customer_id, amount_paise, paid_paise, due_at, issued_at, status, ageing_bucket,
       po_number, dispute_open, dispute_type, dispute_notes, email_thread
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertGt = db.prepare(
    `INSERT INTO ground_truth (
       customer_id, pay_propensity_bps, channel_affinity_json, time_decay_halflife_hours,
       discount_sensitivity_bps, price_sensitivity_bps, max_tolerable_contacts,
       would_pay_anyway, latent_credit_day
     ) VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  const insertGte = db.prepare(
    `INSERT INTO ground_truth_events (
       source_ref, customer_id, surface, true_root_cause, would_pay_anyway,
       true_channel_json, hours_until_unassisted, contact_fatigue_bps
     ) VALUES (?,?,?,?,?,?,?,?)`,
  );
  const insertDlt = db.prepare(
    `INSERT INTO dlt_templates (id, channel, purpose, body, registered, dlt_entity_id)
     VALUES (?,?,?,?,1,?)`,
  );
  const insertMeta = db.prepare(`INSERT INTO sim_meta (key, value) VALUES (?,?)`);

  const persist = db.transaction(() => {
    for (const c of customers) {
      insertCustomer.run(
        c.id, c.segment, c.name, c.email, c.phone, c.language, c.timezone,
        c.consent_email, c.consent_sms, c.consent_whatsapp, c.consent_voice,
        c.dnd, c.opted_out, c.opted_out_at, c.opted_out_channels, c.digital_literacy,
        c.ltv_paise, c.preferred_channel, c.salary_credit_day, c.fraud_flag, c.bankruptcy_flag,
        c.city, c.created_at,
      );
    }
    for (const s of subs) {
      insertSub.run(
        s.id, s.customer_id, s.plan_name, s.amount_paise, s.cadence, s.status, s.mandate_id,
        s.started_at, s.next_charge_at, s.cancelled_at,
      );
    }
    for (const m of mandates) {
      insertMan.run(
        m.id, m.customer_id, m.subscription_id, m.method, m.status, m.debit_cap_paise,
        m.issuer, m.gateway, m.bin, m.last4, m.expiry_month, m.expiry_year, m.umn,
        m.break_reason, m.revoked_at, m.last_pre_debit_notice_at, m.created_at,
      );
    }
    for (const p of pays) {
      insertPay.run(
        p.id, p.customer_id, p.subscription_id, p.mandate_id, p.invoice_id, p.checkout_id,
        p.amount_paise, p.method, p.gateway, p.issuer, p.bin, p.status, p.decline_code,
        p.decline_category, p.three_ds_dropped, p.attempted_at, p.in_outage_window, p.open_failure,
      );
    }
    for (const ch of checkouts) {
      insertChk.run(
        ch.id, ch.customer_id, ch.amount_paise, ch.item_count, ch.device, ch.preferred_method,
        ch.drop_stage, ch.drop_reason, ch.started_at, ch.last_activity_at, ch.abandoned, ch.converted,
      );
    }
    for (const inv of invoices) {
      insertInv.run(
        inv.id, inv.customer_id, inv.amount_paise, inv.paid_paise, inv.due_at, inv.issued_at,
        inv.status, inv.ageing_bucket, inv.po_number, inv.dispute_open, inv.dispute_type,
        inv.dispute_notes, inv.email_thread,
      );
    }
    for (const t of DLT_TEMPLATES) {
      insertDlt.run(t.id, t.channel, t.purpose, t.body, DLT_ENTITY_ID);
    }
  });
  persist();

  db.exec(`
    UPDATE customers SET ltv_paise = COALESCE((
      SELECT SUM(amount_paise) FROM payment_attempts
      WHERE payment_attempts.customer_id = customers.id AND status = 'SUCCESS'
    ), 0)
  `);

  // --- gateway_health from attempts --------------------------------------
  db.exec(`
    INSERT INTO gateway_health (
      id, gateway, method, issuer, bin, granularity, window_start, window_end,
      success_rate_bps, attempt_count, success_count, is_degraded
    )
    SELECT
      'gh_d_' || gateway || '_' || issuer || '_' || (attempted_at / ${DAY}),
      gateway,
      NULL,
      issuer,
      NULL,
      'DAY',
      (attempted_at / ${DAY}) * ${DAY},
      (attempted_at / ${DAY}) * ${DAY} + ${DAY},
      CAST(SUM(CASE WHEN status='SUCCESS' THEN 10000 ELSE 0 END) / COUNT(*) AS INTEGER),
      COUNT(*),
      SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END),
      0
    FROM payment_attempts
    WHERE attempted_at >= ${asOf - 30 * DAY}
    GROUP BY gateway, issuer, attempted_at / ${DAY}
  `);

  db.exec(`
    INSERT INTO gateway_health (
      id, gateway, method, issuer, bin, granularity, window_start, window_end,
      success_rate_bps, attempt_count, success_count, is_degraded
    )
    SELECT
      'gh_h_' || gateway || '_' || issuer || '_' || (attempted_at / ${HOUR}),
      gateway,
      NULL,
      issuer,
      NULL,
      'HOUR',
      (attempted_at / ${HOUR}) * ${HOUR},
      (attempted_at / ${HOUR}) * ${HOUR} + ${HOUR},
      CAST(SUM(CASE WHEN status='SUCCESS' THEN 10000 ELSE 0 END) / COUNT(*) AS INTEGER),
      COUNT(*),
      SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END),
      MAX(CASE WHEN gateway = '${INCIDENT.gateway}' AND issuer = '${INCIDENT.issuer}'
                AND attempted_at >= ${outage.start} AND attempted_at < ${outage.end}
               THEN 1 ELSE 0 END)
    FROM payment_attempts
    WHERE attempted_at >= ${outage.start - 12 * HOUR} AND attempted_at < ${outage.end + 12 * HOUR}
    GROUP BY gateway, issuer, attempted_at / ${HOUR}
  `);

  // --- ground truth -------------------------------------------------------
  const gtTx = db.transaction(() => {
    for (const c of customers) {
      const base =
        c.segment === "ENTERPRISE" ? rng.int(5500, 8500) : c.segment === "SMB" ? rng.int(4000, 7500) : rng.int(2500, 7000);
      const pay_propensity_bps = Math.max(200, base - c.fraud_flag * 4000 - c.bankruptcy_flag * 5000 - c.opted_out * 1500);
      const would = rng.bool(Math.min(8000, 1500 + Math.trunc(pay_propensity_bps / 2))) ? 1 : 0;
      insertGt.run(
        c.id,
        pay_propensity_bps,
        affinityJson(rng),
        rng.int(24, 336),
        rng.int(500, 8000),
        rng.int(500, 8000),
        rng.int(2, 8),
        would,
        c.salary_credit_day,
      );
    }

    const eventWould = (c: CustomerRow, exposure: number, cause: string): number => {
      const gt = { nsf: cause === "INSUFFICIENT_FUNDS", systemic: cause === "SYSTEMIC_GATEWAY_OUTAGE" };
      let p = 2800;
      if (gt.nsf) p += 1500;
      if (gt.systemic) p += 2500;
      if (cause === "DISTRACTION") p += 2000;
      if (cause === "EXPIRED_CARD" || cause === "MANDATE_REVOKED" || cause === "FRAUD_OR_BLOCKED") p -= 2000;
      if (c.fraud_flag || c.bankruptcy_flag) p = 200;
      if (exposure > rupeesToPaise(100000)) p -= 1500;
      if (exposure < rupeesToPaise(500)) p += 1000;
      p = Math.max(200, Math.min(8500, p));
      return rng.bool(p) ? 1 : 0;
    };

    // Surface A
    const openA = db
      .query(
        `SELECT p.id, p.customer_id, p.amount_paise, p.decline_category, p.decline_code, p.in_outage_window
         FROM payment_attempts p
         LEFT JOIN mandates m ON m.id = p.mandate_id
         WHERE p.open_failure = 1
           AND (p.mandate_id IS NULL OR m.status = 'ACTIVE')`,
      )
      .all() as {
      id: string;
      customer_id: string;
      amount_paise: number;
      decline_category: DeclineCategory;
      decline_code: string;
      in_outage_window: number;
    }[];
    for (const p of openA) {
      const c = byId.get(p.customer_id)!;
      const cause = trueCauseA(p.decline_category, p.decline_code, p.in_outage_window);
      const w = eventWould(c, p.amount_paise, cause);
      insertGte.run(
        p.id,
        p.customer_id,
        "A",
        cause,
        w,
        affinityJson(rng),
        w ? rng.int(12, 168) : null,
        rng.int(0, 4000),
      );
    }

    // Surface B
    for (const ch of checkouts.filter((x) => x.abandoned === 1)) {
      const c = byId.get(ch.customer_id)!;
      const cause = ch.drop_reason ?? "DISTRACTION";
      const w = eventWould(c, ch.amount_paise, cause);
      insertGte.run(ch.id, ch.customer_id, "B", cause, w, affinityJson(rng), w ? rng.int(6, 72) : null, rng.int(0, 3000));
    }

    // Surface C
    for (const m of mandates.filter((x) => x.status !== "ACTIVE" && x.status !== "PAUSED")) {
      const c = byId.get(m.customer_id)!;
      const s = subById.get(m.subscription_id);
      const exposure = s ? s.amount_paise : 0;
      const cause = m.break_reason ?? "MANDATE_FAILED";
      const w = eventWould(c, exposure, cause);
      insertGte.run(m.id, m.customer_id, "C", cause, w, affinityJson(rng), w ? rng.int(24, 240) : null, rng.int(0, 5000));
    }

    // Surface D
    for (const inv of invoices.filter((x) => ["PAST_DUE", "DISPUTED", "PARTIAL"].includes(x.status) && x.amount_paise - x.paid_paise > 0)) {
      const c = byId.get(inv.customer_id)!;
      const outstanding = inv.amount_paise - inv.paid_paise;
      const cause = inv.dispute_type ?? (inv.ageing_bucket === "90_PLUS" ? "CASH_CRUNCH" : "INVOICE_UNPAID");
      const w = eventWould(c, outstanding, cause);
      insertGte.run(
        inv.id,
        inv.customer_id,
        "D",
        cause,
        w,
        affinityJson(rng),
        w ? rng.int(48, 360) : null,
        rng.int(0, 4000),
      );
    }
  });
  gtTx();

  const fp = fingerprint(db);

  insertMeta.run("seed", String(seed));
  insertMeta.run("as_of_iso", AS_OF_ISO);
  insertMeta.run("as_of_ms", String(asOf));
  insertMeta.run("incident_gateway", INCIDENT.gateway);
  insertMeta.run("incident_issuer", INCIDENT.issuer);
  insertMeta.run("incident_start_iso", INCIDENT.startIso);
  insertMeta.run("incident_end_iso", INCIDENT.endIso);
  insertMeta.run("abandon_threshold_minutes", "30");
  insertMeta.run("fingerprint", fp);
  insertMeta.run("policy_version", POLICY_VERSION);
  insertMeta.run("model_version", MODEL_VERSION);

  appendAudit(db, {
    actor: "SYSTEM",
    action: "SEED_STARTED",
    entityType: "sim",
    entityId: "world",
    inputs: { seed, asOf: AS_OF_ISO },
    decision: "BEGIN",
    reasonCodes: ["SEED"],
    policyVersion: POLICY_VERSION,
    modelVersion: MODEL_VERSION,
    ts: now,
  });
  appendAudit(db, {
    actor: "SYSTEM",
    action: "OUTAGE_INJECTED",
    entityType: "sim",
    entityId: `${INCIDENT.gateway}x${INCIDENT.issuer}`,
    inputs: INCIDENT,
    decision: "INJECT",
    reasonCodes: ["SYSTEMIC_INCIDENT_FIXTURE"],
    policyVersion: POLICY_VERSION,
    modelVersion: MODEL_VERSION,
    ts: outage.start,
  });
  appendAudit(db, {
    actor: "SYSTEM",
    action: "SEED_COMPLETED",
    entityType: "sim",
    entityId: "world",
    inputs: { fingerprint: fp, customers: customers.length },
    decision: "COMMIT",
    reasonCodes: ["SEED"],
    policyVersion: POLICY_VERSION,
    modelVersion: MODEL_VERSION,
    ts: now,
  });

  const report = buildReport(db, seed, fp, asOf, outage);
  return { report, fingerprint: fp };
}

function q<T>(db: Database, sql: string): T {
  return db.query(sql).get() as T;
}

function qa<T>(db: Database, sql: string): T[] {
  return db.query(sql).all() as T[];
}

function buildReport(
  db: Database,
  seed: number,
  fp: string,
  asOf: number,
  outage: { start: number; end: number },
): string {
  const nCust = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM customers`).n;
  const segs = qa<{ segment: string; n: number }>(
    db,
    `SELECT segment, COUNT(*) AS n FROM customers GROUP BY segment ORDER BY segment`,
  );
  const langs = qa<{ language: string; n: number }>(
    db,
    `SELECT language, COUNT(*) AS n FROM customers GROUP BY language ORDER BY language`,
  );

  type Surf = { n: number; paise: number };
  const surfaceA = q<Surf>(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(p.amount_paise),0) AS paise
     FROM payment_attempts p
     LEFT JOIN mandates m ON m.id = p.mandate_id
     WHERE p.open_failure = 1
       AND (p.mandate_id IS NULL OR m.status = 'ACTIVE')`,
  );
  const surfaceB = q<Surf>(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount_paise),0) AS paise
     FROM checkout_sessions WHERE abandoned = 1`,
  );
  const surfaceC = q<Surf>(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(s.amount_paise),0) AS paise
     FROM mandates m
     JOIN subscriptions s ON s.id = m.subscription_id
     WHERE m.status IN ('REVOKED','EXPIRED','FAILED','CAP_EXCEEDED')`,
  );
  const surfaceD = q<Surf>(
    db,
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount_paise - paid_paise),0) AS paise
     FROM invoices
     WHERE status IN ('PAST_DUE','DISPUTED','PARTIAL')
       AND amount_paise - paid_paise > 0`,
  );

  const totalEvents = surfaceA.n + surfaceB.n + surfaceC.n + surfaceD.n;
  const totalPaise = surfaceA.paise + surfaceB.paise + surfaceC.paise + surfaceD.paise;

  const declines = qa<{ decline_category: string; n: number }>(
    db,
    `SELECT decline_category, COUNT(*) AS n FROM payment_attempts
     WHERE status='FAILED' AND decline_category IS NOT NULL
     GROUP BY decline_category ORDER BY n DESC`,
  );
  const declinesEx = qa<{ decline_category: string; n: number }>(
    db,
    `SELECT decline_category, COUNT(*) AS n FROM payment_attempts
     WHERE status='FAILED' AND decline_category IS NOT NULL AND in_outage_window = 0
     GROUP BY decline_category ORDER BY n DESC`,
  );
  const failN = declines.reduce((a, r) => a + r.n, 0);
  const failExN = declinesEx.reduce((a, r) => a + r.n, 0);

  const methods = qa<{ method: string; n: number }>(
    db,
    `SELECT method, COUNT(*) AS n FROM mandates GROUP BY method ORDER BY n DESC`,
  );

  const ageing = qa<{ ageing_bucket: string; n: number; paise: number }>(
    db,
    `SELECT ageing_bucket, COUNT(*) AS n, COALESCE(SUM(amount_paise-paid_paise),0) AS paise
     FROM invoices
     WHERE status IN ('PAST_DUE','DISPUTED','PARTIAL') AND amount_paise-paid_paise>0
     GROUP BY ageing_bucket ORDER BY ageing_bucket`,
  );

  const outageAttempts = q<{ n: number; failed: number }>(
    db,
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed
     FROM payment_attempts WHERE in_outage_window = 1`,
  );
  const outagePair = q<{ n: number; failed: number; bps: number }>(
    db,
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed,
            CAST(SUM(CASE WHEN status='SUCCESS' THEN 10000 ELSE 0 END)/COUNT(*) AS INTEGER) AS bps
     FROM payment_attempts
     WHERE gateway='${INCIDENT.gateway}' AND issuer='${INCIDENT.issuer}' AND in_outage_window=1`,
  );
  const baselinePair = q<{ n: number; bps: number }>(
    db,
    `SELECT COUNT(*) AS n,
            CAST(SUM(CASE WHEN status='SUCCESS' THEN 10000 ELSE 0 END)/COUNT(*) AS INTEGER) AS bps
     FROM payment_attempts
     WHERE gateway='${INCIDENT.gateway}' AND issuer='${INCIDENT.issuer}' AND in_outage_window=0`,
  );

  const gt = q<{ n: number; anyway: number }>(
    db,
    `SELECT COUNT(*) AS n, SUM(would_pay_anyway) AS anyway FROM ground_truth`,
  );
  const gte = q<{ n: number; anyway: number }>(
    db,
    `SELECT COUNT(*) AS n, SUM(would_pay_anyway) AS anyway FROM ground_truth_events`,
  );

  const flags = q<{ dnd: number; opt: number; fraud: number; bank: number }>(
    db,
    `SELECT SUM(dnd) AS dnd, SUM(opted_out) AS opt, SUM(fraud_flag) AS fraud, SUM(bankruptcy_flag) AS bank FROM customers`,
  );

  const nPay = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM payment_attempts`).n;
  const nSub = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM subscriptions`).n;
  const nMan = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM mandates`).n;
  const nChk = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM checkout_sessions`).n;
  const nInv = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM invoices`).n;
  const nIncidents = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM incidents`).n;
  const nAudit = q<{ n: number }>(db, `SELECT COUNT(*) AS n FROM audit_events`).n;

  const pct = (n: number, d: number) => (d === 0 ? "0.0" : ((n * 1000) / d / 10).toFixed(1));

  const declineTable = (rows: { decline_category: string; n: number }[], den: number) =>
    rows
      .map((r) => `| ${r.decline_category} | ${r.n} | ${pct(r.n, den)}% |`)
      .join("\n");

  const lines = [
    `# Seed report — Recoup simulated economy`,
    ``,
    `- **Seed:** \`${seed}\``,
    `- **As-of:** ${AS_OF_ISO}`,
    `- **DB:** \`data/recovery.db\``,
    `- **Fingerprint:** \`${fp}\``,
    `- **Re-run:** \`bun run seed -- --seed ${seed}\``,
    ``,
    `## Acceptance`,
    ``,
    `Plan: *batch of ≥1,000 risk-bearing events, total ₹ at risk printed by surface; re-runnable with a fixed seed for identical results.*`,
    ``,
    `| Check | Result |`,
    `|---|---|`,
    `| Risk-bearing events | **${totalEvents}** ${totalEvents >= 1000 ? "PASS" : "FAIL"} |`,
    `| ₹ at risk (all surfaces) | **${formatInr(totalPaise)}** |`,
    `| Deterministic seed | \`${seed}\` (see fingerprint) |`,
    ``,
    `## ₹ at risk by surface`,
    ``,
    `| Surface | Events | ₹ at risk |`,
    `|---|---:|---:|`,
    `| A Payment failure | ${surfaceA.n} | ${formatInr(surfaceA.paise)} |`,
    `| B Checkout abandonment | ${surfaceB.n} | ${formatInr(surfaceB.paise)} |`,
    `| C Mandate breakage | ${surfaceC.n} | ${formatInr(surfaceC.paise)} |`,
    `| D B2B receivables | ${surfaceD.n} | ${formatInr(surfaceD.paise)} |`,
    `| **Total** | **${totalEvents}** | **${formatInr(totalPaise)}** |`,
    ``,
    `Surface A excludes failed charges whose mandate is already broken (those rupees live on C).`,
    ``,
    `## Population`,
    ``,
    `| | Count |`,
    `|---|---:|`,
    `| Customers | ${nCust} |`,
    `| Subscriptions | ${nSub} |`,
    `| Mandates | ${nMan} |`,
    `| Payment attempts | ${nPay} |`,
    `| Checkout sessions | ${nChk} |`,
    `| Invoices | ${nInv} |`,
    `| Incidents table (must be 0 until Step 2) | ${nIncidents} |`,
    `| Audit events | ${nAudit} |`,
    ``,
    `### Segment`,
    ``,
    segs.map((s) => `- ${s.segment}: ${s.n}`).join("\n"),
    ``,
    `### Language`,
    ``,
    langs.map((s) => `- ${s.language}: ${s.n}`).join("\n"),
    ``,
    `### Compliance fixtures`,
    ``,
    `- DND: ${flags.dnd}`,
    `- Opted out: ${flags.opt}`,
    `- Fraud flag: ${flags.fraud}`,
    `- Bankruptcy flag: ${flags.bank}`,
    ``,
    `## Payment mix (mandates)`,
    ``,
    methods.map((m) => `- ${m.method}: ${m.n} (${pct(m.n, nMan)}%)`).join("\n"),
    ``,
    `## Decline-code distribution`,
    ``,
    `### All failures (includes injected outage)`,
    ``,
    `| Category | N | Share |`,
    `|---|---:|---:|`,
    declineTable(declines, failN),
    ``,
    `### Ex-outage (should track the plan: 35 / 15 / 20 / 15 / 10 / 5)`,
    ``,
    `| Category | N | Share |`,
    `|---|---:|---:|`,
    declineTable(declinesEx, failExN),
    ``,
    `## Injected systemic incident`,
    ``,
    `- Gateway × issuer: **${INCIDENT.gateway} × ${INCIDENT.issuer}**`,
    `- Window: ${INCIDENT.startIso} → ${INCIDENT.endIso} (6 hours)`,
    `- Attempts in window (all): ${outageAttempts.n} (${outageAttempts.failed} failed)`,
    `- Razorpay × HDFC in window: ${outagePair.n} attempts, success ${outagePair.bps} bps (${(outagePair.bps / 100).toFixed(1)}%)`,
    `- Razorpay × HDFC outside window: ${baselinePair.n} attempts, success ${baselinePair.bps} bps (${(baselinePair.bps / 100).toFixed(1)}%)`,
    `- \`incidents\` rows: ${nIncidents} (detector must create this in Step 2)`,
    ``,
    `## Invoice ageing (at-risk)`,
    ``,
    `| Bucket | N | Outstanding |`,
    `|---|---:|---:|`,
    ...ageing.map((a) => `| ${a.ageing_bucket} | ${a.n} | ${formatInr(a.paise)} |`),
    ``,
    `## Ground truth (hidden)`,
    ``,
    `- Customer rows: ${gt.n}, would_pay_anyway=${gt.anyway} (${pct(gt.anyway, gt.n)}%)`,
    `- Event rows: ${gte.n}, would_pay_anyway=${gte.anyway} (${pct(gte.anyway, gte.n)}%)`,
    `- Engines other than the Step 6 outcome resolver must not read these tables.`,
    ``,
    `## Assumptions`,
    ``,
    `1. Decline taxonomy as in \`docs/DATA_DICTIONARY.md\` (plan listed buckets, not ISO8583 codes).`,
    `2. Event-level truth lives in \`ground_truth_events\` because root cause is per leak, not per customer.`,
    `3. Probabilities stored as integer bps. Display percentages in this report are derived with integer tenths.`,
    `4. A small NRI timezone slice (Dubai/London/NY) exists so quiet-hours is demonstrable.`,
    `5. TRAI DLT templates are pre-seeded; the \`incidents\` table is intentionally empty.`,
    `6. Monthly cadence uses calendar month addition from start date, not a fixed 30-day period.`,
    ``,
    `## Next`,
    ``,
    `Step 2 — Detection engine: map every leak to one \`risk_item\`, flag the outage as an incident, stratified holdout.`,
  ];

  return lines.join("\n");
}

function runOnce(dbPath: string, seed: number): { report: string; fingerprint: string } {
  resetDbFile(dbPath);
  const db = openDb(dbPath);
  try {
    applySchema(db);
    return seedWorld(db, seed);
  } finally {
    db.close();
  }
}

function main() {
  const { seed, dbPath, verify } = parseArgs();
  if (verify) {
    const a = join(tmpdir(), `recoup_repro_a_${seed}.db`);
    const b = join(tmpdir(), `recoup_repro_b_${seed}.db`);
    const ra = runOnce(a, seed);
    const rb = runOnce(b, seed);
    if (ra.fingerprint !== rb.fingerprint) {
      console.error("REPRO FAIL");
      console.error("A", ra.fingerprint);
      console.error("B", rb.fingerprint);
      process.exit(1);
    }
    console.log("REPRO PASS");
    console.log(ra.fingerprint);
    return;
  }

  const { report, fingerprint: fp } = runOnce(dbPath, seed);
  mkdirSync("out", { recursive: true });
  writeFileSync("out/seed_report.md", report);
  console.log(report);
  console.log(`\nWrote ${dbPath}`);
  console.log(`Wrote out/seed_report.md`);
  console.log(`fingerprint ${fp}`);
}

main();
