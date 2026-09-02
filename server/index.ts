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
import { createHmac, timingSafeEqual } from "node:crypto";
import { exportCaseTimeline, testTamperProof, verifyChain } from "../engines/audit";
import { runMeasurement } from "../engines/measure";
import { DEFAULT_DB_PATH, openDb } from "../src/db";
import { formatInr } from "../src/money";
import { getAiConfig, updateAiConfig, maskApiKey, AVAILABLE_MODELS } from "../src/ai/config";
import { testAiConnection } from "../src/ai/llm_client";
import { resolveCase } from "../src/resolution";
import { createRazorpayPaymentLink, generatePaymentLink, hasRazorpayCredentials } from "../adapters/payment_link";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const db = openDb(DEFAULT_DB_PATH);

// Pre-run measurement to cache headline numbers
let measurement = runMeasurement(db);

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
               r.incident_id, r.resolved_via, r.payment_link_url,
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

      // Count total (without LIMIT) for pagination indicator
      let totalSql = `
        SELECT COUNT(*) AS cnt
        FROM risk_items r
        JOIN customers c ON c.id = r.customer_id
        LEFT JOIN diagnoses d ON d.risk_item_id = r.id
        LEFT JOIN intervention_plans p ON p.risk_item_id = r.id
        WHERE 1=1
      `;
      const totalParams: any[] = [];
      if (surface) { totalSql += ` AND r.surface = ?`; totalParams.push(surface); }
      if (cohort) { totalSql += ` AND r.cohort = ?`; totalParams.push(cohort); }
      if (state) { totalSql += ` AND r.state = ?`; totalParams.push(state); }
      const totalRow = db.query(totalSql).get(...totalParams) as any;
      const totalCount = totalRow?.cnt ?? rows.length;

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

      const normalizedRows = rows.map((r) => ({
        ...r,
        id: r.id,
        riskItemId: r.id,
        customerId: r.customer_id,
        customerName: r.customer_name,
        exposurePaise: r.exposure_paise ?? 0,
        exposureInr: (r.exposure_paise ?? 0) / 100,
        rootCause: r.root_cause || "INVOICE_UNPAID",
        playbook: r.playbook || "DUNNING_LADDER",
        recoveredPaise: r.recovered_paise ?? 0,
        recoveredInr: (r.recovered_paise ?? 0) / 100,
        resolvedVia: r.resolved_via,
        paymentLinkUrl: r.payment_link_url,
      }));

      return Response.json({ cases: normalizedRows, total: totalCount, showing: normalizedRows.length });
    }

    // Sub-route: Mint a Razorpay payment link for a specific case
    if (path.startsWith("/api/case/") && path.endsWith("/payment-link") && req.method === "POST") {
      const id = path.replace("/api/case/", "").replace("/payment-link", "");
      try {
        const row = db
          .query(`
            SELECT r.id, r.exposure_paise, c.name, c.email, c.phone
            FROM risk_items r
            JOIN customers c ON c.id = r.customer_id
            WHERE r.id = ?
          `)
          .get(id) as {
            id: string;
            exposure_paise: number;
            name: string;
            email: string;
            phone: string;
          } | null;

        if (!row) {
          return new Response(JSON.stringify({ error: `Case '${id}' not found.` }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const linkResult = await createRazorpayPaymentLink({
          riskItemId: row.id,
          amountPaise: row.exposure_paise,
          customerName: row.name,
          email: row.email,
          phone: row.phone,
          db,
        });

        return Response.json({
          success: true,
          shortUrl: linkResult.shortUrl,
          paymentLinkId: linkResult.id,
          isMock: !linkResult.isLive,
          paymentLink: linkResult,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Sub-route: Simulate an incoming payment_link.paid webhook resolution for a specific case
    if (path.startsWith("/api/case/") && path.endsWith("/simulate-payment") && req.method === "POST") {
      const id = path.replace("/api/case/", "").replace("/simulate-payment", "");
      try {
        const row = db
          .query(`
            SELECT r.id, r.exposure_paise, r.state, c.name
            FROM risk_items r
            JOIN customers c ON c.id = r.customer_id
            WHERE r.id = ?
          `)
          .get(id) as {
            id: string;
            exposure_paise: number;
            state: string;
            name: string;
          } | null;

        if (!row) {
          return new Response(JSON.stringify({ error: `Case '${id}' not found.` }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const paymentRef = `plink_test_${Date.now()}`;
        const resolution = resolveCase(db, {
          riskItemId: row.id,
          amountPaise: row.exposure_paise,
          paymentReference: paymentRef,
          resolvedVia: "razorpay_live_webhook",
          channel: "RAZORPAY_PAYMENT_LINK",
        });

        return Response.json({
          success: true,
          riskItemId: row.id,
          state: "RECOVERED",
          resolvedVia: "razorpay_live_webhook",
          recoveredPaise: row.exposure_paise,
          auditEventSeq: resolution.auditEventSeq,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Case timeline drilldown
    if (path.startsWith("/api/case/") && req.method === "GET") {
      const id = path.replace("/api/case/", "");
      try {
        const timeline = exportCaseTimeline(db, id);
        // Look up active payment link if generated
        try {
          const plink = db
            .query(`SELECT id, short_url, is_live, status, created_at FROM payment_links WHERE risk_item_id = ? ORDER BY created_at DESC LIMIT 1`)
            .get(id) as any;
          if (plink) {
            (timeline as any).paymentLink = plink;
          }
        } catch {}
        return Response.json(timeline);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 404 });
      }
    }

    // --- RAZORPAY LIVE RAIL ENDPOINTS ---

    // 1. Create a live Razorpay test-mode Payment Link on demand
    if (path === "/api/rail/razorpay/create-link" && req.method === "POST") {
      try {
        const body = (await req.json().catch(() => ({}))) as { riskItemId?: string };
        if (!body.riskItemId) {
          return new Response(JSON.stringify({ error: "Missing riskItemId in request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const row = db
          .query(`
            SELECT r.id, r.exposure_paise, c.name, c.email, c.phone
            FROM risk_items r
            JOIN customers c ON c.id = r.customer_id
            WHERE r.id = ?
          `)
          .get(body.riskItemId) as {
            id: string;
            exposure_paise: number;
            name: string;
            email: string;
            phone: string;
          } | null;

        if (!row) {
          return new Response(JSON.stringify({ error: `Case '${body.riskItemId}' not found.` }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const linkResult = await createRazorpayPaymentLink({
          riskItemId: row.id,
          amountPaise: row.exposure_paise,
          customerName: row.name,
          email: row.email,
          phone: row.phone,
          db,
        });

        return Response.json({
          success: true,
          paymentLink: linkResult,
          hasCredentials: hasRazorpayCredentials(),
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 2. Razorpay Webhook Consumer (HMAC-SHA256 signature verified)
    if (path === "/webhooks/razorpay" && req.method === "POST") {
      try {
        const rawBody = await req.text();
        const signature = req.headers.get("x-razorpay-signature");
        const webhookSecret =
          process.env.RAZORPAY_WEBHOOK_SECRET ||
          process.env.RAZORPAY_KEY_SECRET ||
          "";

        // Verify cryptographic signature if secret or signature is provided
        if (webhookSecret && signature) {
          const expectedSignature = createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

          const sigBuf = Buffer.from(signature);
          const expBuf = Buffer.from(expectedSignature);
          if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
            console.warn("[WEBHOOK_SIGNATURE_MISMATCH] Razorpay webhook signature check failed.");
            return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        } else if (process.env.NODE_ENV === "production") {
          return new Response(JSON.stringify({ error: "Webhook signature header or secret missing." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
        }

        console.log(`[RAZORPAY_WEBHOOK] Consuming event: ${event.event} (id: ${event.id ?? "none"})`);

        if (event.event === "payment_link.paid" || event.event === "payment.captured") {
          const plink = event.payload?.payment_link?.entity;
          const payment = event.payload?.payment?.entity;

          const riskItemId =
            plink?.reference_id ||
            payment?.notes?.risk_item_id ||
            payment?.notes?.reference_id;

          const amountPaise =
            plink?.amount_paid ||
            plink?.amount ||
            payment?.amount;

          const paymentRef = payment?.id || plink?.id || `rzp_pay_${Date.now()}`;

          if (!riskItemId) {
            return Response.json({
              status: "ignored",
              reason: "No riskItemId found in reference_id or notes",
            });
          }

          const res = resolveCase(db, {
            riskItemId,
            amountPaise: Number(amountPaise),
            channel: "PAYMENT_LINK",
            playbook: "RAZORPAY_LIVE_RAIL",
            resolvedVia: "razorpay_live_webhook",
            paymentRef,
            reasonCode: "RAZORPAY_WEBHOOK_PAID",
          });

          // Refresh measurement cache so dashboard overview numbers update immediately
          try {
            measurement = runMeasurement(db);
          } catch {}

          return Response.json({
            status: "ok",
            event: event.event,
            riskItemId,
            paymentRef,
            resolved: res.success,
            alreadyRecovered: res.alreadyRecovered ?? false,
          });
        }

        return Response.json({ status: "acknowledged", event: event.event });
      } catch (err: any) {
        console.error("[RAZORPAY_WEBHOOK_FATAL]", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
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

    if (path === "/api/settings/ai") {
      if (req.method === "GET") {
        const config = getAiConfig();
        return Response.json({
          config: {
            ...config,
            openRouterApiKeyMasked: maskApiKey(config.openRouterApiKey),
            geminiApiKeyMasked: maskApiKey(config.geminiApiKey),
            openaiApiKeyMasked: maskApiKey(config.openaiApiKey),
            hasOpenRouterKey: Boolean(config.openRouterApiKey),
            hasGeminiKey: Boolean(config.geminiApiKey),
            hasOpenaiKey: Boolean(config.openaiApiKey),
          },
          availableModels: AVAILABLE_MODELS,
        });
      }

      if (req.method === "POST") {
        try {
          const body = (await req.json()) as any;
          const updates: any = {};
          if (body.activeProvider) updates.activeProvider = body.activeProvider;
          if (body.activeModel) updates.activeModel = body.activeModel;
          if (body.temperature !== undefined) updates.temperature = parseFloat(body.temperature);
          if (body.openRouterApiKey !== undefined && !body.openRouterApiKey.includes("••••")) {
            updates.openRouterApiKey = body.openRouterApiKey.trim();
          }
          if (body.geminiApiKey !== undefined && !body.geminiApiKey.includes("••••")) {
            updates.geminiApiKey = body.geminiApiKey.trim();
          }
          if (body.openaiApiKey !== undefined && !body.openaiApiKey.includes("••••")) {
            updates.openaiApiKey = body.openaiApiKey.trim();
          }

          const updated = updateAiConfig(updates);
          return Response.json({
            success: true,
            config: {
              ...updated,
              openRouterApiKeyMasked: maskApiKey(updated.openRouterApiKey),
              geminiApiKeyMasked: maskApiKey(updated.geminiApiKey),
              openaiApiKeyMasked: maskApiKey(updated.openaiApiKey),
              hasOpenRouterKey: Boolean(updated.openRouterApiKey),
              hasGeminiKey: Boolean(updated.geminiApiKey),
              hasOpenaiKey: Boolean(updated.openaiApiKey),
            },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
      }
    }

    if (path === "/api/settings/ai/test" && req.method === "POST") {
      try {
        const body = (await req.json().catch(() => ({}))) as any;
        const testResult = await testAiConnection(body);
        return Response.json(testResult);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // --- STATIC FILES (Serves React build from web/dist) ---
    const distIndex = join("web", "dist", "index.html");

    if (path === "/" || path === "/index.html") {
      if (existsSync(distIndex)) {
        const html = readFileSync(distIndex, "utf8");
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return new Response("React build not found. Run 'bun run build:ui' to build the frontend.", { status: 404 });
    }

    if (path.startsWith("/assets/")) {
      const assetPath = join("web", "dist", path);
      if (existsSync(assetPath)) {
        const fileContent = readFileSync(assetPath);
        const contentType = path.endsWith(".js")
          ? "application/javascript; charset=utf-8"
          : path.endsWith(".css")
          ? "text/css; charset=utf-8"
          : path.endsWith(".svg")
          ? "image/svg+xml"
          : path.endsWith(".png")
          ? "image/png"
          : "application/octet-stream";
        return new Response(fileContent, { headers: { "Content-Type": contentType } });
      }
    }

    // Fallback to index.html for SPA client-side routing
    if (existsSync(distIndex) && !path.startsWith("/api/") && !path.startsWith("/webhooks/")) {
      const html = readFileSync(distIndex, "utf8");
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
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
