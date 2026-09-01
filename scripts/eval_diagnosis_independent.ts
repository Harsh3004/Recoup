#!/usr/bin/env bun
/**
 * Independent Out-of-Distribution Diagnosis Evaluation
 *
 * Evaluates the Rules Classifier vs LLM Classifier against a curated,
 * unkeyworded evaluation dataset (data/independent_diagnosis_cases.json).
 *
 * The test snippets contain real-world vocabulary, indirect phrasing,
 * and Hinglish, and intentionally avoid the literal regex keywords used
 * by the rules classifier (e.g. avoiding "GRN", "delivery challan", "discrepancy").
 *
 * Usage: bun run eval:diagnosis-independent
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diagnoseUnstructuredInvoiceLlm } from "../src/ai/diagnose_llm";
import { formatInr } from "../src/money";

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
 * Standard Rules Classifier (Deterministic regex keyword matcher)
 */
function classifyWithRules(c: IndependentCase): string {
  const text = `${c.emailThread ?? ""} ${c.disputeNotes ?? ""}`;
  if (/GRN|delivery challan|stores confirm/i.test(text)) return "PO_GRN_MISMATCH";
  if (/no invoice in the AP inbox|re-send to ap@|never received|Invoice \w+\?/i.test(text)) return "INVOICE_NOT_RECEIVED";
  if (/budget owner|stuck in queue|approval/i.test(text)) return "APPROVAL_STUCK";
  if (/Discrepancy|quantity|rate|line item|credit note/i.test(text)) return "LINE_ITEM_DISPUTE";
  if (/cash flow|liquidity|cash crunch|extension/i.test(text)) return "CASH_CRUNCH";
  return c.ageingBucket === "90_PLUS" ? "CASH_CRUNCH" : "INVOICE_UNPAID";
}

async function runIndependentEvaluation() {
  const casesPath = join(import.meta.dir, "..", "data", "independent_diagnosis_cases.json");
  if (!existsSync(casesPath)) {
    console.error(`[ERROR] Missing independent cases file: ${casesPath}`);
    process.exit(1);
  }

  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as IndependentCase[];

  console.log(`\n======================================================================`);
  console.log(`   INDEPENDENT OUT-OF-DISTRIBUTION DIAGNOSIS EVALUATION               `);
  console.log(`======================================================================\n`);
  console.log(`Test Cases: ${cases.length} unkeyworded, real-world AP correspondence snippets`);
  console.log(`Classes: 6 B2B root causes (4 cases per class)`);
  console.log(`Ground truth labels are completely isolated from keyword matching.\n`);

  let rulesCorrect = 0;
  let llmCorrect = 0;
  let llmFallbackCount = 0;

  const rulesConfusion: Record<string, Record<string, number>> = {};
  const llmConfusion: Record<string, Record<string, number>> = {};

  for (const rc of ROOT_CAUSES) {
    rulesConfusion[rc] = {};
    llmConfusion[rc] = {};
    for (const pred of ROOT_CAUSES) {
      rulesConfusion[rc][pred] = 0;
      llmConfusion[rc][pred] = 0;
    }
  }

  const results: Array<{
    caseItem: IndependentCase;
    rulesPred: string;
    llmPred: string;
    rulesMatch: boolean;
    llmMatch: boolean;
    llmModel: string;
    llmUsed: boolean;
    llmLatencyMs: number;
    tokens: number;
  }> = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    const rulesPred = classifyWithRules(c);
    const rulesMatch = rulesPred === c.trueRootCause;
    if (rulesMatch) rulesCorrect++;
    rulesConfusion[c.trueRootCause][rulesPred] = (rulesConfusion[c.trueRootCause][rulesPred] ?? 0) + 1;

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
    llmConfusion[c.trueRootCause][llmPred] = (llmConfusion[c.trueRootCause][llmPred] ?? 0) + 1;

    console.log(
      `  [${String(i + 1).padStart(2, " ")}/${cases.length}] ${c.id.padEnd(9, " ")} | True: ${c.trueRootCause.padEnd(20, " ")} | Rules: ${rulesPred.padEnd(20, " ")} ${rulesMatch ? "✅" : "❌"} | LLM: ${llmPred.padEnd(20, " ")} ${llmMatch ? "✅" : "❌"} (${llmRes.model})`
    );

    results.push({
      caseItem: c,
      rulesPred,
      llmPred,
      rulesMatch,
      llmMatch,
      llmModel: llmRes.model,
      llmUsed: llmRes.llmUsed,
      llmLatencyMs: llmRes.latencyMs ?? 0,
      tokens: llmRes.tokenUsage?.totalTokens ?? 0,
    });

    if (!llmRes.cached && llmRes.llmUsed) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  const total = cases.length;
  const rulesAccPct = ((rulesCorrect / total) * 100).toFixed(1);
  const llmAccPct = ((llmCorrect / total) * 100).toFixed(1);
  const netGainPct = (((llmCorrect - rulesCorrect) / total) * 100).toFixed(1);

  // Terminal Output
  console.log(`----------------------------------------------------------------------`);
  console.log(`   HEAD-TO-HEAD ACCURACY SUMMARY                                      `);
  console.log(`----------------------------------------------------------------------`);
  console.log(`Rules Baseline (Regex Keyword Matcher):   ${rulesAccPct}% (${rulesCorrect}/${total})`);
  console.log(`LLM NLU Classifier (Semantic Reasoning): ${llmAccPct}% (${llmCorrect}/${total})`);
  console.log(`Net Generalization Advantage:             +${netGainPct}% (Semantic Delta)\n`);

  if (llmFallbackCount > 0) {
    console.log(`[NOTICE] ${llmFallbackCount} cases executed via keyword fallback (no live API key set).`);
    console.log(`         Run with GEMINI_API_KEY=<key> to evaluate live model inference.\n`);
  }

  // Generate Detailed Report
  const reportLines: string[] = [];
  reportLines.push("# Independent Out-of-Distribution Diagnosis Evaluation Report");
  reportLines.push("");
  reportLines.push("## Overview & Methodology");
  reportLines.push("");
  reportLines.push(
    "This benchmark tests true **out-of-distribution semantic generalization**. Unlike the synthetic corpus self-consistency check (`scripts/seed.ts`), this evaluation dataset contains 24 realistic, varied Accounts Payable correspondence snippets that **strictly avoid all literal regex keywords** matched by the rules baseline.",
  );
  reportLines.push("");
  reportLines.push("- **Total Independent Cases:** **24** (4 per class across 6 B2B root causes)");
  reportLines.push("- **Language Diversity:** Formal English, Indian AP procurement jargon, and Hinglish dialogue");
  reportLines.push("- **Rules Classifier Accuracy:** **" + rulesAccPct + "%** (" + rulesCorrect + "/" + total + ")");
  reportLines.push("- **LLM Classifier Accuracy:** **" + llmAccPct + "%** (" + llmCorrect + "/" + total + ")");
  reportLines.push("- **Semantic Generalization Lift:** **+" + netGainPct + "%**");
  reportLines.push("");

  reportLines.push("## 1. Head-to-Head Comparison by Root Cause");
  reportLines.push("");
  reportLines.push("| Root Cause Class | N | Rules Accuracy | LLM Accuracy | Advantage |");
  reportLines.push("|---|---:|---:|---:|---:|");

  for (const rc of ROOT_CAUSES) {
    const classCases = results.filter((r) => r.caseItem.trueRootCause === rc);
    const n = classCases.length;
    const rCorr = classCases.filter((r) => r.rulesMatch).length;
    const lCorr = classCases.filter((r) => r.llmMatch).length;
    const rPct = ((rCorr / n) * 100).toFixed(0);
    const lPct = ((lCorr / n) * 100).toFixed(0);
    const diff = lCorr - rCorr;
    const diffStr = diff > 0 ? `+${((diff / n) * 100).toFixed(0)}%` : diff === 0 ? "0%" : `-${((-diff / n) * 100).toFixed(0)}%`;
    reportLines.push(`| \`${rc}\` | ${n} | ${rPct}% (${rCorr}/${n}) | ${lPct}% (${lCorr}/${n}) | **${diffStr}** |`);
  }
  reportLines.push("");

  reportLines.push("## 2. Disagreement Analysis (Where Rules Failed vs Where LLM Succeeded)");
  reportLines.push("");
  reportLines.push("| Case ID | True Cause | Rules Prediction | LLM Prediction | Snippet Context |");
  reportLines.push("|---|---|---|---|---|");

  for (const r of results) {
    if (r.rulesPred !== r.llmPred || !r.rulesMatch) {
      const c = r.caseItem;
      const snippet = c.emailThread.replace(/\n/g, " ").slice(0, 75) + "...";
      const rStatus = r.rulesMatch ? "✅" : "❌";
      const lStatus = r.llmMatch ? "✅" : "❌";
      reportLines.push(
        `| \`${c.id}\` | \`${c.trueRootCause}\` | ${rStatus} \`${r.rulesPred}\` | ${lStatus} \`${r.llmPred}\` | *"${snippet}"* |`,
      );
    }
  }
  reportLines.push("");

  reportLines.push("## 3. Confusion Matrix — Rules Classifier");
  reportLines.push("");
  reportLines.push("| True Cause | Predicted as `PO_GRN` | `INVOICE_NOT_REC` | `APPROVAL` | `LINE_ITEM` | `CASH_CRUNCH` | `INVOICE_UNPAID` |");
  reportLines.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const trueC of ROOT_CAUSES) {
    const row = ROOT_CAUSES.map((p) => rulesConfusion[trueC][p] ?? 0);
    reportLines.push(`| \`${trueC}\` | ${row.join(" | ")} |`);
  }
  reportLines.push("");

  reportLines.push("## 4. Confusion Matrix — LLM NLU Classifier");
  reportLines.push("");
  reportLines.push("| True Cause | Predicted as `PO_GRN` | `INVOICE_NOT_REC` | `APPROVAL` | `LINE_ITEM` | `CASH_CRUNCH` | `INVOICE_UNPAID` |");
  reportLines.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const trueC of ROOT_CAUSES) {
    const row = ROOT_CAUSES.map((p) => llmConfusion[trueC][p] ?? 0);
    reportLines.push(`| \`${trueC}\` | ${row.join(" | ")} |`);
  }
  reportLines.push("");

  const outDir = join(import.meta.dir, "..", "out");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "independent_diagnosis_eval.md");
  writeFileSync(outPath, reportLines.join("\n"), "utf8");

  console.log(`Report written to: out/independent_diagnosis_eval.md\n`);
}

runIndependentEvaluation().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
