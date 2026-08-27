#!/usr/bin/env bun
/**
 * Recoup Demo Server (Step 9)
 *
 * Serves the Single-Page Executive Dashboard & Live JSON APIs:
 * - GET /api/overview: Headline metrics, counterfactuals, surface breakdowns
 * - GET /api/cases: Filterable case list
 * - GET /api/case/:id: Complete case drilldown timeline
 * - GET /api/incident: Systemic incident replay details
 * - POST /api/verify: Live cryptographic hash chain verification
 * - POST /api/tamper-test: Proof of tamper-evidence attack simulation
 *
 * Usage: bun run server/index.ts [--port 3000]
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { exportCaseTimeline, testTamperProof, verifyChain } from "../engines/audit";
import { runMeasurement } from "../engines/measure";
import { DEFAULT_DB_PATH, openDb } from "../src/db";
import { formatInr } from "../src/money";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const db = openDb(DEFAULT_DB_PATH);

// Pre-run measurement to cache headline numbers
const measurement = runMeasurement(db);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // --- API ROUTES ---
    if (path === "/api/overview") {
      const comms = db.query(`SELECT COUNT(*) AS c FROM communications`).get() as { c: number };
      const gateStats = db
        .query(
          `SELECT allowed, reason_code, COUNT(*) AS count
           FROM gate_decisions GROUP BY allowed, reason_code`,
        )
        .all() as { allowed: number; reason_code: string; count: number }[];

      const totalAllowed = gateStats.filter((g) => g.allowed === 1).reduce((s, g) => s + g.count, 0);
      const totalBlocked = gateStats.filter((g) => g.allowed === 0).reduce((s, g) => s + g.count, 0);

      const chainStatus = verifyChain(db);

      return Response.json({
        headline: {
          totalCases: measurement.totalCases,
          treatmentCases: measurement.treatmentCases,
          holdoutCases: measurement.holdoutCases,
          totalExposureInr: (measurement.treatmentExposurePaise + measurement.holdoutExposurePaise) / 100,
          treatmentRecoveredInr: measurement.treatmentRecoveredPaise / 100,
          scaledHoldoutBaselineInr: measurement.scaledHoldoutBaselinePaise / 100,
          incrementalRecoveredInr: measurement.incrementalRecoveredPaise / 100,
          incrementalLiftPct: measurement.incrementalLiftPct,
          ci95: {
            lowerInr: measurement.bootstrapCi95.lowerPaise / 100,
            upperInr: measurement.bootstrapCi95.upperPaise / 100,
            lowerLiftPct: measurement.bootstrapCi95.lowerLiftPct,
            upperLiftPct: measurement.bootstrapCi95.upperLiftPct,
          },
          commsSent: comms.c,
          gateAllowed: totalAllowed,
          gateSuppressed: totalBlocked,
          auditEventsChained: chainStatus.totalEvents,
          chainValid: chainStatus.valid,
        },
        counterfactuals: {
          pureHoldout: {
            grossInr: measurement.counterfactuals.pureHoldout.grossRecoveredPaise / 100,
            netInr: measurement.counterfactuals.pureHoldout.netValuePaise / 100,
          },
          naiveDunning: {
            grossInr: measurement.counterfactuals.naiveDunning.grossRecoveredPaise / 100,
            costInr: measurement.counterfactuals.naiveDunning.channelCostPaise / 100,
            netInr: measurement.counterfactuals.naiveDunning.netValuePaise / 100,
          },
          recoupEngine: {
            grossInr: measurement.counterfactuals.recoupEngine.grossRecoveredPaise / 100,
            costInr: measurement.counterfactuals.recoupEngine.channelCostPaise / 100,
            netInr: measurement.counterfactuals.recoupEngine.netValuePaise / 100,
            incrementalOverNaiveInr: measurement.counterfactuals.recoupEngine.incrementalOverNaivePaise / 100,
          },
        },
        bySurface: measurement.bySurface,
        bySegment: measurement.bySegment,
        byPlaybook: measurement.byPlaybook,
        gateSuppressions: gateStats.filter((g) => g.allowed === 0),
      });
    }

    if (path === "/api/cases") {
      const surface = url.searchParams.get("surface");
      const cohort = url.searchParams.get("cohort");
      const state = url.searchParams.get("state");
      const query = url.searchParams.get("q")?.toLowerCase();

      let sql = `
        SELECT r.id, r.surface, r.customer_id, r.exposure_paise, r.state, r.cohort,
               r.incident_id,
               c.name AS customer_name, c.segment, c.language,
               d.root_cause, d.confidence_bps, d.is_systemic,
               p.playbook, p.ev_paise,
               COALESCE(rec.amount_paise, 0) AS recovered_paise
        FROM risk_items r
        JOIN customers c ON c.id = r.customer_id
        LEFT JOIN diagnoses d ON d.risk_item_id = r.id
        LEFT JOIN intervention_plans p ON p.risk_item_id = r.id
        LEFT JOIN recoveries rec ON rec.risk_item_id = r.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (surface) {
        sql += ` AND r.surface = ?`;
        params.push(surface);
      }
      if (cohort) {
        sql += ` AND r.cohort = ?`;
        params.push(cohort);
      }
      if (state) {
        sql += ` AND r.state = ?`;
        params.push(state);
      }

      sql += ` ORDER BY r.exposure_paise DESC LIMIT 200`;

      let rows = db.query(sql).all(...params) as any[];

      if (query) {
        rows = rows.filter(
          (r) =>
            r.id.toLowerCase().includes(query) ||
            r.customer_name.toLowerCase().includes(query) ||
            r.customer_id.toLowerCase().includes(query) ||
            (r.root_cause && r.root_cause.toLowerCase().includes(query)) ||
            (r.playbook && r.playbook.toLowerCase().includes(query)),
        );
      }

      return Response.json({ cases: rows });
    }

    if (path.startsWith("/api/case/")) {
      const id = path.replace("/api/case/", "");
      try {
        const timeline = exportCaseTimeline(db, id);
        return Response.json(timeline);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 404 });
      }
    }

    if (path === "/api/incident") {
      const inc = db.query(`SELECT * FROM incidents LIMIT 1`).get() as any;
      const affectedCases = db
        .query(
          `SELECT r.id, r.surface, r.customer_id, r.exposure_paise, c.name AS customer_name,
                  g.reason_code, g.allowed
           FROM risk_items r
           JOIN customers c ON c.id = r.customer_id
           LEFT JOIN gate_decisions g ON g.risk_item_id = r.id
           WHERE r.incident_id IS NOT NULL`,
        )
        .all() as any[];

      return Response.json({
        incident: inc,
        affectedCasesCount: affectedCases.length,
        contactsSuppressedCount: affectedCases.filter((a) => a.allowed === 0).length,
        cases: affectedCases,
      });
    }

    if (path === "/api/verify" && req.method === "POST") {
      const result = verifyChain(db);
      return Response.json(result);
    }

    if (path === "/api/tamper-test" && req.method === "POST") {
      const result = testTamperProof(db);
      return Response.json(result);
    }

    // --- STATIC FILES ---
    if (path === "/" || path === "/index.html") {
      const html = readFileSync("web/index.html", "utf8");
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (path === "/styles.css") {
      const css = readFileSync("web/styles.css", "utf8");
      return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8" } });
    }

    if (path === "/app.js") {
      const js = readFileSync("web/app.js", "utf8");
      return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`\n=============================================================`);
console.log(`  🚀 Recoup Demo Server is LIVE at http://localhost:${PORT}`);
console.log(`  - Interactive Dashboard: http://localhost:${PORT}`);
console.log(`  - 4 Surfaces Switcher: Ready`);
console.log(`  - Outage Replay & Suppression Visualizer: Ready`);
console.log(`  - 1-Click Case Drilldown: Ready`);
console.log(`  - Live SHA-256 Hash Chain Verifier: Ready`);
console.log(`=============================================================\n`);
