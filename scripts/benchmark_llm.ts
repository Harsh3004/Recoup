#!/usr/bin/env bun
/**
 * LLM Diagnosis Benchmark Script
 *
 * Benchmarks NLU Diagnosis accuracy vs Rules Baseline against Ground Truth.
 *
 * MODES:
 *   Live mode (OPENAI_API_KEY set):
 *     Runs real gpt-4o-mini inference on all Surface D threads and commits responses
 *     to data/llm_cache.json with full token provenance. Accuracy reflects true LLM
 *     performance and will typically land in the 80–92% range.
 *
 *   Offline mode (no API key):
 *     Uses the offline keyword classifier. Results are labelled as "keyword-classifier"
 *     and the benchmark exits with code 1. This is by design — the benchmark score is
 *     not a valid LLM accuracy figure in offline mode.
 *
 *   Cache-replay mode (cache populated from a prior live run):
 *     All responses served from data/llm_cache.json. Reports real LLM accuracy
 *     deterministically, model name, token totals, and cache provenance.
 *
 * BENCHMARK_STRICT=1 is set automatically when run via `bun run benchmark:llm`.
 * It causes the LLM client to throw on any cache miss rather than silently
 * falling back to the keyword classifier.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../src/db";
import { diagnoseUnstructuredInvoiceLlm } from "../src/ai/diagnose_llm";
import { formatInr } from "../src/money";

// Enable strict mode so the client never silently uses the keyword fallback
process.env.BENCHMARK_STRICT = "1";

const CACHE_FILE = join(import.meta.dir, "..", "data", "llm_cache.json");
const HAS_API_KEY = !!(process.env.OPENAI_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.OPENROUTER_API_KEY);
const ACTIVE_PROVIDER = process.env.GEMINI_API_KEY ? "Gemini" : process.env.OPENAI_API_KEY ? "OpenAI" : process.env.OPENROUTER_API_KEY ? "OpenRouter" : "none";

function getCacheProvenance(): { totalEntries: number; realEntries: number; fallbackEntries: number; models: string[] } {
  if (!existsSync(CACHE_FILE)) return { totalEntries: 0, realEntries: 0, fallbackEntries: 0, models: [] };
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, { model?: string; isFallback?: boolean }>;
    const entries = Object.values(raw);
    const realEntries = entries.filter((e) => !e.isFallback);
    const fallbackEntries = entries.filter((e) => e.isFallback);
    const models = [...new Set(realEntries.map((e) => e.model ?? "unknown").filter(Boolean))];
    return {
      totalEntries: entries.length,
      realEntries: realEntries.length,
      fallbackEntries: fallbackEntries.length,
      models,
    };
  } catch {
    return { totalEntries: 0, realEntries: 0, fallbackEntries: 0, models: [] };
  }
}

async function runBenchmark() {
  const db = openDb();
  console.log(`\n======================================================`);
  console.log(`   RECOUP LLM DIAGNOSIS BENCHMARK (Surface D NLU)     `);
  console.log(`======================================================\n`);

  const cacheInfo = getCacheProvenance();

  if (HAS_API_KEY) {
    console.log(`[MODE] LIVE INFERENCE — ${ACTIVE_PROVIDER} API key detected.`);
    console.log(`       Real LLM calls will populate data/llm_cache.json with token provenance.\n`);
  } else if (cacheInfo.realEntries > 0) {
    console.log(`[MODE] CACHE REPLAY — ${cacheInfo.realEntries} real LLM responses in cache.`);
    console.log(`       Accuracy reflects genuine LLM performance (deterministic cache replay).`);
    console.log(`       Models: ${cacheInfo.models.join(", ")}\n`);
  } else {
    console.error(`[ERROR] OFFLINE MODE — No API key found (GEMINI_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY) and no real-LLM cache entries.`);
    console.error(`        The benchmark cannot produce a valid LLM accuracy figure in this state.`);
    console.error(`        To populate the cache, run: GEMINI_API_KEY=<key> bun run benchmark:llm\n`);
    process.exit(1);
  }

  const invoices = db.query(`
    SELECT i.id, i.customer_id, i.amount_paise, i.status, i.ageing_bucket,
           i.po_number, i.dispute_open, i.dispute_type, i.dispute_notes, i.email_thread,
           c.name AS customer_name, c.segment,
           gte.true_root_cause
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN ground_truth_events gte ON gte.source_ref = i.id
    ORDER BY i.id ASC
  `).all() as Array<{
    id: string;
    customer_id: string;
    amount_paise: number;
    status: string;
    ageing_bucket: string;
    po_number: string | null;
    dispute_open: number;
    dispute_type: string | null;
    dispute_notes: string | null;
    email_thread: string | null;
    customer_name: string;
    segment: string;
    true_root_cause: string;
  }>;

  let llmCorrect = 0;
  let rulesCorrect = 0;
  const totalEvaluated = invoices.length;
  let totalExposurePaise = 0;
  let llmCorrectExposurePaise = 0;
  let rulesCorrectExposurePaise = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let liveCallCount = 0;
  let cacheHitCount = 0;
  let fallbackCount = 0;

  for (const inv of invoices) {
    totalExposurePaise += inv.amount_paise;
    const trueCause = inv.true_root_cause;

    // 1. Rules Baseline (Simple Ageing/Status fallback)
    const rulesPredicted = inv.ageing_bucket === "90_PLUS" ? "CASH_CRUNCH" : "INVOICE_UNPAID";
    if (rulesPredicted === trueCause) {
      rulesCorrect++;
      rulesCorrectExposurePaise += inv.amount_paise;
    }

    // 2. LLM NLU Diagnosis (strict mode — throws on cache miss without API key)
    let llmResult: Awaited<ReturnType<typeof diagnoseUnstructuredInvoiceLlm>>;
    try {
      llmResult = await diagnoseUnstructuredInvoiceLlm({
        riskItemId: `rsk_bench_${inv.id}`,
        invoiceNumber: inv.id,
        customerName: inv.customer_name,
        segment: inv.segment,
        exposurePaise: inv.amount_paise,
        ageingBucket: inv.ageing_bucket ?? "0_30",
        poNumber: inv.po_number,
        disputeOpen: inv.dispute_open === 1,
        disputeType: inv.dispute_type,
        disputeNotes: inv.dispute_notes,
        emailThread: inv.email_thread,
      });
    } catch (err) {
      console.error(`\n[FATAL] Benchmark aborted: ${(err as Error).message}`);
      process.exit(1);
    }

    if (llmResult.fallbackUsed) {
      fallbackCount++;
    } else if (llmResult.cached) {
      cacheHitCount++;
    } else {
      liveCallCount++;
    }

    if (llmResult.tokenUsage) {
      totalPromptTokens += llmResult.tokenUsage.promptTokens;
      totalCompletionTokens += llmResult.tokenUsage.completionTokens;
    }

    if (llmResult.rootCause === trueCause) {
      llmCorrect++;
      llmCorrectExposurePaise += inv.amount_paise;
    }
  }

  // Reject benchmark if any fallback was used — results are not valid LLM accuracy
  if (fallbackCount > 0) {
    console.error(`\n[FATAL] Benchmark invalid: ${fallbackCount}/${totalEvaluated} cases used the keyword classifier fallback.`);
    console.error(`        Accuracy figures from this run do NOT reflect LLM performance.`);
    console.error(`        Populate the cache with real API calls before reporting accuracy.`);
    process.exit(1);
  }

  const llmAcc = ((llmCorrect / totalEvaluated) * 100).toFixed(1);
  const rulesAcc = ((rulesCorrect / totalEvaluated) * 100).toFixed(1);
  const deltaAcc = (parseFloat(llmAcc) - parseFloat(rulesAcc)).toFixed(1);
  const valueUnlocked = formatInr(llmCorrectExposurePaise - rulesCorrectExposurePaise);

  console.log(`Total B2B Cases Evaluated: ${totalEvaluated}`);
  console.log(`Total B2B Exposure:        ${formatInr(totalExposurePaise)}\n`);

  console.log(`| Model / Approach               | Accuracy (%) | Correct Cases | Correctly Classified ₹ |`);
  console.log(`|--------------------------------|-------------:|--------------:|-----------------------:|`);
  console.log(`| Naive Rules Baseline           |       ${rulesAcc}% |     ${rulesCorrect}/${totalEvaluated} | ${formatInr(rulesCorrectExposurePaise).padStart(22, " ")} |`);
  console.log(`| Recoup LLM NLU Diagnostic Agent|       ${llmAcc}% |     ${llmCorrect}/${totalEvaluated} | ${formatInr(llmCorrectExposurePaise).padStart(22, " ")} |\n`);

  console.log(`🎯 Performance Delta: +${deltaAcc}% accuracy gain`);
  console.log(`💰 Diagnostic Value Unlocked: ${valueUnlocked} correctly routed to specialized playbooks.\n`);

  // Provenance summary
  console.log(`── Inference Provenance ──────────────────────────────────────────`);
  console.log(`   Cache hits (real LLM responses):  ${cacheHitCount}`);
  console.log(`   Live API calls this run:           ${liveCallCount}`);
  console.log(`   Keyword classifier fallbacks:      ${fallbackCount} (MUST be 0 for valid benchmark)`);
  if (totalPromptTokens > 0) {
    console.log(`   Total prompt tokens:               ${totalPromptTokens.toLocaleString()}`);
    console.log(`   Total completion tokens:           ${totalCompletionTokens.toLocaleString()}`);
  }
  console.log(`─────────────────────────────────────────────────────────────────\n`);
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
