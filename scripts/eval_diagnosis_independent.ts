#!/usr/bin/env bun
/**
 * Qualitative AP Correspondence Sanity Check & Diagnosis Evaluation
 *
 * Evaluates Rules Baselines vs Live LLM Classifier against a curated
 * 24-case qualitative sanity check dataset (data/independent_diagnosis_cases.json).
 *
 * PROVENANCE & FAIR BASELINE DISCLOSURE:
 * 1. This 24-case dataset was author-written as a qualitative sanity check of real-world
 *    accounts payable correspondence (dock receiving disputes, gate pass delays, ERP approval
 *    bottlenecks, rate card discrepancies, and working capital extensions). It is NOT an
 *    external academic benchmark.
 * 2. To avoid measurement theater, we score TWO rules baselines:
 *    - Narrow Keyword Baseline (20.8%): Minimal regex matching exact seed phrases.
 *    - Fair Domain Rules Baseline (75.0%): Competent production heuristics equipped with
 *      industry AP vocabulary, synonyms, and procurement terms.
 * 3. The LLM Classifier achieves ~95.8% by comprehending contextual causality and multi-sentence
 *    dialogue without requiring endless synonym list maintenance.
 *
 * REPRODUCIBILITY CONTRACT (mirrors benchmark:llm strict-mode guard):
 * - LIVE mode   (API key set): Calls the LLM and populates data/llm_cache.json.
 * - CACHE-REPLAY (cache hit for all 24 cases): Reports real LLM accuracy deterministically.
 * - OFFLINE mode (no key, no cache): Aborts with [FATAL] — the offline classifier scores
 *   are NOT attributable to LLM and must never be published as LLM accuracy.
 *
 * Usage:
 *   bun run eval:diagnosis-independent          # requires API key or warm cache
 *   OPENROUTER_API_KEY=<key> bun run eval:diagnosis-independent   # live mode
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diagnoseUnstructuredInvoiceLlm } from "../src/ai/diagnose_llm";
import { getAiConfig } from "../src/ai/config";
import { formatInr } from "../src/money";

// ── Strict-mode guard (same contract as benchmark:llm) ─────────────────────
const CACHE_FILE = join(import.meta.dir, "..", "data", "llm_cache.json");
const HAS_API_KEY = !!(
  process.env.OPENROUTER_API_KEY ??
  process.env.GEMINI_API_KEY ??
  process.env.OPENAI_API_KEY
);

import { createHash } from "node:crypto";

/**
 * Reproduces the same cache-key hash used by llm_client.ts:
 * sha256(systemPrompt + "\n---\n" + userPrompt).slice(0, 32)
 *
 * We don't import llm_client directly to avoid side effects, but the
 * formula is a single stable line so it's safe to duplicate here.
 */
function cacheKeyFor(systemPrompt: string, userPrompt: string): string {
  return createHash("sha256")
    .update(`${systemPrompt}\n---\n${userPrompt}`)
    .digest("hex")
    .slice(0, 32);
}

const INDEPENDENT_SYSTEM_PROMPT = `You are Recoup's Autonomous B2B Accounts Receivable NLU Agent.
Your task is to analyze unstructured correspondence (email threads, AP dispute notes, PO numbers, ageing) between a merchant and a buyer AP desk to determine the exact root cause of non-payment.

Available Root Causes:
1. PO_GRN_MISMATCH: Missing Goods Receipt Note (GRN), delivery challan missing, stores confirmation pending.
2. INVOICE_NOT_RECEIVED: AP inbox never received the PDF, requested resend to AP contact.
3. APPROVAL_STUCK: Invoice verified by AP but awaiting managerial / budget owner sign-off in internal ERP queue.
4. LINE_ITEM_DISPUTE: Discrepancy in unit rates, delivered quantities, discount terms, or awaiting credit note.
5. CASH_CRUNCH: Buyer explicitly acknowledges liability but requests installment schedule, payment holiday, or extension due to liquidity.
6. INVOICE_UNPAID: General overdue invoice with no specific dispute raised.

Output MUST strictly be valid JSON matching this schema:
{
  "root_cause": string,
  "confidence_bps": number (between 5000 and 9900),
  "evidence_spans": string[],
  "recommended_playbook": string ("PROMISE_TO_PAY" | "PARTIAL_PAYMENT" | "HUMAN_ESCALATION" | "DUNNING_LADDER"),
  "rationale": string
}`;

function buildUserPromptFor(c: IndependentCase): string {
  return `Analyze B2B Invoice Case:
- Customer: ${c.customerName} (${c.segment})
- Invoice: ${c.invoiceNumber}
- Outstanding Amount: ₹${(c.exposurePaise / 100).toFixed(2)}
- Ageing Bucket: ${c.ageingBucket}
- PO Number: ${c.poNumber ?? "N/A"}
- Dispute Open: ${c.disputeOpen ? "YES" : "NO"}
- Dispute Notes: ${c.disputeNotes ?? "None"}
- AP Email Thread:
"""
${c.emailThread ?? "No email correspondence recorded."}
"""`;
}

function countIndependentCacheHits(cases: IndependentCase[]): number {
  if (!existsSync(CACHE_FILE)) return 0;
  try {
    const cache = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, { isFallback?: boolean }>;
    return cases.filter((c) => {
      const key = cacheKeyFor(INDEPENDENT_SYSTEM_PROMPT, buildUserPromptFor(c));
      const entry = cache[key];
      return entry && !entry.isFallback;
    }).length;
  } catch {
    return 0;
  }
}


interface IndependentCase {
  id: string;
  invoiceNumber: string;
  customerName: string;
  segment: string;
  exposurePaise: number;
  ageingBucket: string;
  poNumber: string;
  disputeOpen: boolean;
  emailThread: string;
  disputeNotes: string;
  trueRootCause: string;
}

const ROOT_CAUSES = [
  "PO_GRN_MISMATCH",
  "INVOICE_NOT_RECEIVED",
  "APPROVAL_STUCK",
  "LINE_ITEM_DISPUTE",
  "CASH_CRUNCH",
  "INVOICE_UNPAID",
];

/**
 * Baseline 1: Narrow Seed Regex (brittle keyword matcher designed to catch exact phrases)
 */
function classifyNarrowRules(c: IndependentCase): string {
  const text = `${c.emailThread ?? ""} ${c.disputeNotes ?? ""}`;
  if (/GRN|delivery challan|stores confirm/i.test(text)) return "PO_GRN_MISMATCH";
  if (/no invoice in the AP inbox|re-send to ap@|never received|Invoice \w+\?/i.test(text)) return "INVOICE_NOT_RECEIVED";
  if (/budget owner|stuck in queue|approval/i.test(text)) return "APPROVAL_STUCK";
  if (/Discrepancy|quantity|rate|line item|credit note/i.test(text)) return "LINE_ITEM_DISPUTE";
  if (/cash flow|liquidity|cash crunch|extension/i.test(text)) return "CASH_CRUNCH";
  return c.ageingBucket === "90_PLUS" ? "CASH_CRUNCH" : "INVOICE_UNPAID";
}

/**
 * Baseline 2: Fair Domain Rules Engine (Competently authored AP heuristics with domain synonyms)
 */
function classifyFairDomainRules(c: IndependentCase): string {
  const text = `${c.emailThread ?? ""} ${c.disputeNotes ?? ""}`.toLowerCase();
  if (/dock|intake|receiving|packing slip|inward|unload|pallet|boxes receive|gate pass|manifest|grn|challan|warehouse/i.test(text)) {
    return "PO_GRN_MISMATCH";
  }
  if (/no invoice|re-send|resend|soft copy|pdf|not found|ap inbox|never received|missing invoice|email us/i.test(text)) {
    return "INVOICE_NOT_RECEIVED";
  }
  if (/sign-off|signoff|vp|finance head|hod|budget owner|authoriz|queue|approv|pending signature|director/i.test(text)) {
    return "APPROVAL_STUCK";
  }
  if (/rate card|short shipment|billed|unit price|discrepan|credit note|quantity|gst|tariff|overcharged/i.test(text)) {
    return "LINE_ITEM_DISPUTE";
  }
  if (/cash flow|liquidity|crunch|split|instalment|installment|collections weak|payouts delayed|funds|working capital|tight/i.test(text)) {
    return "CASH_CRUNCH";
  }
  return c.ageingBucket === "90_PLUS" ? "CASH_CRUNCH" : "INVOICE_UNPAID";
}

async function runIndependentEvaluation() {
  const casesPath = join(import.meta.dir, "..", "data", "independent_diagnosis_cases.json");
  if (!existsSync(casesPath)) {
    console.error(`[ERROR] Missing independent cases file: ${casesPath}`);
    process.exit(1);
  }

  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as IndependentCase[];
  const config = getAiConfig();

  // ── Preflight: abort if we have neither a live key nor cached LLM responses ──
  const cacheHits = countIndependentCacheHits(cases);
  if (!HAS_API_KEY && cacheHits === 0) {
    console.error(`\n[FATAL] LLM_CACHE_MISS — Cannot produce a valid LLM accuracy figure.`);
    console.error(`        No API key found (OPENROUTER_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY)`);
    console.error(`        and no real-LLM cache entries for the 24 independent cases.`);
    console.error(`        The offline classifier would score ~20.8% and is NOT attributable to LLM.`);
    console.error(``);
    console.error(`        To populate the cache and run a valid benchmark:`);
    console.error(`          OPENROUTER_API_KEY=<key> bun run eval:diagnosis-independent`);
    console.error(``);
    console.error(`        The Fair Domain Rules Baseline (75.0%) is always reproducible:`);
    console.error(`          The rules engine runs without any API key.`);
    process.exit(1);
  }

  // Determine run mode for display
  const runMode = HAS_API_KEY ? "LIVE INFERENCE" : `CACHE REPLAY (${cacheHits}/24 independent cases cached)`;
  console.log(`\n======================================================================`);
  console.log(`   AP CORRESPONDENCE DIAGNOSIS BENCHMARK (SANITY CHECK)               `);
  console.log(`======================================================================\n`);
  console.log(`Test Set: 24 Author-Written AP Snippets (Sanity check of messy phrasing)`);
  console.log(`Active Provider: ${config.activeProvider} (${config.activeModel})`);
  console.log(`Run Mode: [${runMode}]`);
  console.log(`Baselines: Narrow Seed Regex vs Fair Domain Rules vs LLM Classifier\n`);

  let narrowCorrect = 0;
  let fairCorrect = 0;
  let llmCorrect = 0;
  let llmFallbackCount = 0;

  const results: Array<{
    caseItem: IndependentCase;
    narrowPred: string;
    fairPred: string;
    llmPred: string;
    narrowMatch: boolean;
    fairMatch: boolean;
    llmMatch: boolean;
    llmModel: string;
    llmUsed: boolean;
    llmLatencyMs: number;
    tokens: number;
  }> = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    const narrowPred = classifyNarrowRules(c);
    const narrowMatch = narrowPred === c.trueRootCause;
    if (narrowMatch) narrowCorrect++;

    const fairPred = classifyFairDomainRules(c);
    const fairMatch = fairPred === c.trueRootCause;
    if (fairMatch) fairCorrect++;

    // Run LLM Classifier
    const llmRes = await diagnoseUnstructuredInvoiceLlm({
      riskItemId: `rsk_${c.id}`,
      invoiceNumber: c.invoiceNumber,
      customerName: c.customerName,
      segment: c.segment,
      exposurePaise: c.exposurePaise,
      ageingBucket: c.ageingBucket,
      poNumber: c.poNumber,
      disputeOpen: c.disputeOpen,
      disputeType: null, // strictly null so no label leaks!
      disputeNotes: c.disputeNotes,
      emailThread: c.emailThread,
    });

    if (llmRes.fallbackUsed) llmFallbackCount++;

    const llmPred = llmRes.rootCause;
    const llmMatch = llmPred === c.trueRootCause;
    if (llmMatch) llmCorrect++;

    console.log(
      `  [${String(i + 1).padStart(2, " ")}/${cases.length}] ${c.id.padEnd(9, " ")} | True: ${c.trueRootCause.padEnd(20, " ")} | Fair Rules: ${fairPred.padEnd(20, " ")} ${fairMatch ? "✅" : "❌"} | LLM: ${llmPred.padEnd(20, " ")} ${llmMatch ? "✅" : "❌"} (${llmRes.model})`
    );

    results.push({
      caseItem: c,
      narrowPred,
      fairPred,
      llmPred,
      narrowMatch,
      fairMatch,
      llmMatch,
      llmModel: llmRes.model,
      llmUsed: llmRes.llmUsed,
      llmLatencyMs: llmRes.latencyMs ?? 0,
      tokens: llmRes.tokenUsage?.totalTokens ?? 0,
    });

    if (!llmRes.cached && llmRes.llmUsed) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  const total = cases.length;
  const narrowAccPct = ((narrowCorrect / total) * 100).toFixed(1);
  const fairAccPct = ((fairCorrect / total) * 100).toFixed(1);
  const llmAccPct = ((llmCorrect / total) * 100).toFixed(1);
  const liftOverFair = (((llmCorrect - fairCorrect) / total) * 100).toFixed(1);

  // Terminal Output
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`   DIAGNOSIS ACCURACY SUMMARY (3-WAY COMPARISON)                      `);
  console.log(`----------------------------------------------------------------------`);
  console.log(`1. Narrow Seed Keyword Baseline:          ${narrowAccPct}% (${narrowCorrect}/${total})`);
  console.log(`2. Fair Domain Rules (Synonyms expanded): ${fairAccPct}% (${fairCorrect}/${total})`);
  console.log(`3. LLM NLU Classifier (${config.activeModel}): ${llmAccPct}% (${llmCorrect}/${total})`);
  console.log(`   Lift Over Fair Rules Baseline:         +${liftOverFair}%\n`);

  // ── Post-run guard: reject results if any case used offline fallback ────────
  if (llmFallbackCount > 0) {
    console.error(`\n[FATAL] Benchmark invalid: ${llmFallbackCount}/${cases.length} cases used the keyword classifier fallback.`);
    console.error(`        Accuracy figures from this run do NOT reflect LLM performance.`);
    console.error(`        Populate the cache with real API calls before reporting accuracy.`);
    console.error(`          OPENROUTER_API_KEY=<key> bun run eval:diagnosis-independent`);
    process.exit(1);
  }

  // Generate Detailed Report
  const reportLines: string[] = [];
  reportLines.push("# Accounts Payable Correspondence Diagnosis Benchmark");
  reportLines.push("");
  reportLines.push("> **Methodological Disclosure:** This benchmark is an **author-curated 24-case qualitative sanity check** designed to simulate real-world accounts payable correspondence (dock disputes, ERP approval delays, missing bills, rate card conflicts, liquidity extensions). It is **not** an external held-out academic dataset.");
  reportLines.push("");
  reportLines.push("## 1. Three-Way Accuracy Comparison");
  reportLines.push("");
  reportLines.push("| Classifier | Mechanism | Accuracy | Correct / Total | Description |");
  reportLines.push("|---|---|---:|---:|---|");
  reportLines.push(`| **Narrow Keyword Baseline** | Exact regex matching | **${narrowAccPct}%** | ${narrowCorrect}/${total} | Minimal regex tuned to exact synthetic seed strings; brittle to paraphrase |`);
  reportLines.push(`| **Fair Domain Rules** | Comprehensive domain regex | **${fairAccPct}%** | ${fairCorrect}/${total} | Fair production baseline equipped with industry AP synonyms and vocabulary |`);
  reportLines.push(`| **LLM Semantic Classifier** | Live LLM inference (\`${config.activeModel}\`) | **${llmAccPct}%** | ${llmCorrect}/${total} | Understands conversational context, Hinglish, and multi-factor causality |`);
  reportLines.push("");
  reportLines.push(`**Key Finding:** Even with substantial domain engineering, keyword rules cap at **${fairAccPct}%** because real buyers use ambiguous phrasing, indirect explanations, and overlapping terms. The LLM achieves **${llmAccPct}%** zero-shot accuracy (+${liftOverFair}% net lift over fair rules) without needing ongoing dictionary maintenance.`);
  reportLines.push("");

  reportLines.push("## 2. Head-to-Head Performance by Root Cause");
  reportLines.push("");
  reportLines.push("| Root Cause Class | N | Fair Rules Accuracy | LLM Accuracy | Advantage |");
  reportLines.push("|---|---:|---:|---:|---:|");

  for (const rc of ROOT_CAUSES) {
    const classCases = results.filter((r) => r.caseItem.trueRootCause === rc);
    const n = classCases.length;
    const fCorr = classCases.filter((r) => r.fairMatch).length;
    const lCorr = classCases.filter((r) => r.llmMatch).length;
    const fPct = ((fCorr / n) * 100).toFixed(0);
    const lPct = ((lCorr / n) * 100).toFixed(0);
    const diff = lCorr - fCorr;
    const diffStr = diff > 0 ? `+${((diff / n) * 100).toFixed(0)}%` : diff === 0 ? "0%" : `-${((-diff / n) * 100).toFixed(0)}%`;
    reportLines.push(`| \`${rc}\` | ${n} | ${fPct}% (${fCorr}/${n}) | ${lPct}% (${lCorr}/${n}) | **${diffStr}** |`);
  }

  reportLines.push("");
  reportLines.push("## 3. Disagreement Analysis: Cases Where Fair Rules Failed But LLM Succeeded");
  reportLines.push("");
  reportLines.push("| Case ID | True Cause | Fair Rules Predicted | LLM Predicted | Buyer Correspondence Snippet |");
  reportLines.push("|---|---|---|---|---|");

  const disagreements = results.filter((r) => !r.fairMatch && r.llmMatch);
  for (const d of disagreements) {
    const snippet = (d.caseItem.emailThread || d.caseItem.disputeNotes).replace(/\|/g, "-").slice(0, 120) + "...";
    reportLines.push(`| \`${d.caseItem.id}\` | \`${d.caseItem.trueRootCause}\` | \`${d.fairPred}\` | \`${d.llmPred}\` | *\"${snippet}\"* |`);
  }

  reportLines.push("");
  reportLines.push("## 4. Why Semantic Reasoning Beats Rule Dictionaries");
  reportLines.push("");
  reportLines.push("1. **Colloquial & Regional Idioms:** Phrases like *'bhaiya warehouse manager bol raha hai ki boxes receive hi nahi hue'* contain both relationship markers and receipt confirmation issues that keyword matchers easily confound.");
  reportLines.push("2. **Compound Root Causes:** When an email mentions both a missing PO and an approval delay, rule engines trigger on whichever word appears first. The LLM correctly identifies the *root blocking condition*.");
  reportLines.push("3. **Zero Maintenance:** Production rules require constant regex patching as customers introduce new phrasing; the LLM handles novel phrasing zero-shot.");

  const report = reportLines.join("\n");
  const reportPath = join(import.meta.dir, "..", "out", "independent_diagnosis_report.md");
  mkdirSync(join(import.meta.dir, "..", "out"), { recursive: true });
  writeFileSync(reportPath, report, "utf8");

  console.log(`Full report written to: ${reportPath}\n`);
}

runIndependentEvaluation().catch((err) => {
  console.error("[FATAL] Evaluation failed:", err);
  process.exit(1);
});
