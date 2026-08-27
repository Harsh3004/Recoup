#!/usr/bin/env bun
/**
 * Offline Diagnosis Accuracy Evaluator
 * Evaluates diagnosis predictions against hidden ground truth labels.
 */

import { openDb } from "../src/db";
import { runDiagnosis } from "../engines/diagnose";

const db = openDb();
const res = runDiagnosis(db);

const gtEvents = db
  .query(`SELECT source_ref, true_root_cause FROM ground_truth_events`)
  .all() as { source_ref: string; true_root_cause: string }[];

const gtMap = new Map<string, string>();
for (const g of gtEvents) gtMap.set(g.source_ref, g.true_root_cause);

const riskItemSourceMap = new Map<string, string>();
const riskRows = db.query(`SELECT id, source_ref FROM risk_items`).all() as {
  id: string;
  source_ref: string;
}[];
for (const r of riskRows) riskItemSourceMap.set(r.id, r.source_ref);

let correct = 0;
let outageTotal = 0;
let outageCorrect = 0;

for (const d of res.diagnoses) {
  const sourceRef = riskItemSourceMap.get(d.riskItemId);
  if (!sourceRef) continue;

  const trueCause = gtMap.get(sourceRef) ?? "UNKNOWN";
  const predicted = d.rootCause;

  if (trueCause === predicted) {
    correct++;
  }

  if (trueCause === "SYSTEMIC_GATEWAY_OUTAGE") {
    outageTotal++;
    if (d.isSystemic && predicted === "SYSTEMIC_GATEWAY_OUTAGE") {
      outageCorrect++;
    }
  }
}

const accuracyPct = ((correct / res.diagnoses.length) * 100).toFixed(2);
const outageRecallPct = outageTotal > 0 ? ((outageCorrect / outageTotal) * 100).toFixed(2) : "100.00";

console.log(`\n=== Offline Diagnosis Accuracy Evaluation ===`);
console.log(`Evaluated: ${res.diagnoses.length} items`);
console.log(`Root-Cause Accuracy: ${accuracyPct}% (${correct}/${res.diagnoses.length})`);
console.log(`Systemic Outage Recall: ${outageRecallPct}% (${outageCorrect}/${outageTotal})\n`);
