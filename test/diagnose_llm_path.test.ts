import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { diagnoseRiskItem, runDiagnosis } from "../engines/diagnose";
import { applySchema, openDb } from "../src/db";
import { diagnoseUnstructuredInvoiceLlm } from "../src/ai/diagnose_llm";

describe("Live Path LLM Diagnosis & Honest Provenance Tracking", () => {
  let db: Database;
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenAI = process.env.OPENAI_API_KEY;
  const originalOpenRouter = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    applySchema(db);

    // Insert baseline customer
    db.exec(`
      INSERT INTO customers (id, segment, name, email, phone, language, timezone, digital_literacy, created_at)
      VALUES ('cust_test_1', 'ENTERPRISE', 'Tata Consultancy B2B', 'ap@tata.com', '+919876543210', 'EN', 'Asia/Kolkata', 'HIGH', 1000);
    `);

    // Insert structured clean invoice (no email thread, no dispute)
    db.exec(`
      INSERT INTO invoices (id, customer_id, amount_paise, due_at, issued_at, status, ageing_bucket, po_number, dispute_open)
      VALUES ('inv_clean', 'cust_test_1', 5000000, 1500, 1000, 'PAST_DUE', '31_60', 'PO_1001', 0);
    `);
    db.exec(`
      INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort)
      VALUES ('rsk_clean', 'D', 'cust_test_1', 'inv_clean', 5000000, 5000, 5000, 125000, 2000, 'OPEN', 'TREATMENT');
    `);

    // Insert unstructured invoice with AP email thread
    db.exec(`
      INSERT INTO invoices (id, customer_id, amount_paise, due_at, issued_at, status, ageing_bucket, po_number, dispute_open, email_thread)
      VALUES ('inv_unstructured', 'cust_test_1', 12000000, 1500, 1000, 'PAST_DUE', '61_90', 'PO_9999', 0, 'Hi Team, missing delivery challan and GRN from stores. Need confirmation before payment release.');
    `);
    db.exec(`
      INSERT INTO risk_items (id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps, risk_score, first_seen_at, state, cohort)
      VALUES ('rsk_unstructured', 'D', 'cust_test_1', 'inv_unstructured', 12000000, 7000, 7000, 588000, 2000, 'OPEN', 'TREATMENT');
    `);
  });

  afterEach(() => {
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
    else delete process.env.GEMINI_API_KEY;
    if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
    else delete process.env.OPENAI_API_KEY;
    if (originalOpenRouter) process.env.OPENROUTER_API_KEY = originalOpenRouter;
    else delete process.env.OPENROUTER_API_KEY;

    db.close();
  });

  it("honest runtime invariant: without API key, llmUsed is false and llmSkippedReason is 'no_api_key'", async () => {
    const riskItem = db.query(`SELECT * FROM risk_items WHERE id = 'rsk_unstructured'`).get() as any;
    const diag = await diagnoseRiskItem(db, riskItem, Date.now());

    expect(diag.llmUsed).toBe(false);
    expect(diag.llmSkippedReason).toBe("no_api_key");
    expect(diag.rootCause).toBe("PO_GRN_MISMATCH");
    expect(diag.modelVersion).toBeNull();
    expect(diag.evidence.some((e) => e.includes("LLM skipped: no_api_key"))).toBe(true);
  });

  it("clean structured invoice does not trigger LLM path and uses deterministic ageing rule", async () => {
    const riskItem = db.query(`SELECT * FROM risk_items WHERE id = 'rsk_clean'`).get() as any;
    const diag = await diagnoseRiskItem(db, riskItem, Date.now());

    expect(diag.llmUsed).toBe(false);
    expect(diag.llmSkippedReason).toBeNull();
    expect(diag.rootCause).toBe("INVOICE_UNPAID");
    expect(diag.evidence.some((e) => e.includes("Deterministic rule"))).toBe(true);
  });

  it("diagnoseUnstructuredInvoiceLlm provides honest token usage and latency when API key is present", async () => {
    process.env.GEMINI_API_KEY = "test_key_replay";

    const res = await diagnoseUnstructuredInvoiceLlm({
      riskItemId: "rsk_bench_inv_000001",
      invoiceNumber: "inv_000001",
      customerName: "Indigo Workshops Bengaluru",
      segment: "SMB",
      exposurePaise: 2500000,
      ageingBucket: "61_90",
      poNumber: "PO-00001",
      disputeOpen: false,
      disputeType: null,
      disputeNotes: null,
      emailThread: "From: cfo@indigo.workshops.bengaluru.recoup.test\nSubject: Re: inv_000001 overdue\n\nInvoice inv_000001 (₹25,000.00) note kiya. Is mahine collections weak hain. Do dates mein split kar sakte hain?",
    });

    expect(res.llmUsed).toBe(true);
    expect(res.llmSkippedReason).toBeNull();
    expect(res.model).toBe("gemini-3.6-flash");
    expect(res.tokenUsage).toBeDefined();
    expect(res.tokenUsage?.promptTokens).toBe(488);
    expect(res.tokenUsage?.completionTokens).toBe(120);
    expect(res.tokenUsage?.totalTokens).toBe(1262);
    expect(res.latencyMs).toBeGreaterThanOrEqual(1);
    expect(res.cached).toBe(true);
  });

  it("runDiagnosis commits llm_latency_ms, llm_token_usage, and llm_skipped_reason to diagnoses table and audit_events", async () => {
    const res = await runDiagnosis(db, { evalAccuracy: false });
    expect(res.totalDiagnosed).toBe(2);

    const rows = db.query(`SELECT * FROM diagnoses ORDER BY id ASC`).all() as any[];
    expect(rows.length).toBe(2);

    const unstructuredRow = rows.find((r) => r.risk_item_id === "rsk_unstructured");
    expect(unstructuredRow).toBeDefined();
    expect(unstructuredRow.llm_used).toBe(0);
    expect(unstructuredRow.llm_skipped_reason).toBe("no_api_key");

    // Verify cryptographic audit ledger recorded the diagnosis decision with provenance inputs
    const auditRow = db.query(`
      SELECT * FROM audit_events
      WHERE entity_id = 'rsk_unstructured' AND action = 'DIAGNOSIS_COMMITTED'
    `).get() as any;
    expect(auditRow).toBeDefined();
    expect(auditRow.inputs_digest).toBeDefined();
  });
});
