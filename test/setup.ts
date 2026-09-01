import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Creates an isolated in-memory SQLite database populated with full schema
 * and baseline test fixtures for unit tests.
 * Guarantees tests pass in isolation without requiring external database state.
 */
export function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  // Load schema
  const schemaPath = join(import.meta.dir, "..", "db", "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);

  const now = Date.now();

  // Insert standard test fixtures
  db.exec(`
    INSERT INTO customers (
      id, segment, name, email, phone, language, timezone,
      consent_email, consent_sms, consent_whatsapp, consent_voice,
      dnd, opted_out, digital_literacy, ltv_paise, created_at, fraud_flag, bankruptcy_flag
    ) VALUES 
      ('cus_test_001', 'B2C', 'Aarav Sharma', 'aarav@example.com', '+919876543210', 'EN', 'Asia/Kolkata', 1, 1, 1, 1, 0, 0, 'HIGH', 500000, ${now}, 0, 0),
      ('cus_test_dnd', 'B2C', 'Rohan Gupta', 'rohan@example.com', '+919876543211', 'HI', 'Asia/Kolkata', 1, 1, 1, 1, 1, 0, 'MEDIUM', 300000, ${now}, 0, 0),
      ('cus_test_opted_out', 'SMB', 'Pooja Mehta', 'pooja@example.com', '+919876543212', 'EN', 'Asia/Kolkata', 1, 1, 1, 1, 0, 1, 'HIGH', 1500000, ${now}, 0, 0),
      ('cus_test_fraud', 'B2C', 'Vikram Singh', 'vikram@example.com', '+919876543213', 'EN', 'Asia/Kolkata', 1, 1, 1, 1, 0, 0, 'LOW', 200000, ${now}, 1, 0),
      ('cus_test_nri', 'B2C', 'Rahul Verma', 'rahul@example.com', '+971501234567', 'EN', 'Asia/Dubai', 1, 1, 1, 1, 0, 0, 'HIGH', 800000, ${now}, 0, 0);

    INSERT INTO dlt_templates (id, channel, purpose, body, registered, dlt_entity_id)
    VALUES ('dlt_test_01', 'SMS', 'PAYMENT_REMINDER', 'Dear {#var#}, your payment of {#var#} is pending: {#var#}', 1, '1101524380000012345');

    INSERT INTO invoices (
      id, customer_id, amount_paise, paid_paise, due_at, issued_at,
      status, ageing_bucket, po_number, dispute_open, dispute_type, dispute_notes, email_thread
    ) VALUES (
      'inv_test_dispute', 'cus_test_001', 2500000, 0, ${now - 86400000}, ${now - 10000000},
      'PAST_DUE', '31_60', 'PO-9082', 1, 'LINE_ITEM_DISPUTE', 'Line item discrepancy raised on unit rate', 'Customer AP flagged mismatch on pricing'
    );

    INSERT INTO risk_items (
      id, surface, customer_id, source_ref, exposure_paise, p_loss_bps, urgency_bps,
      risk_score, first_seen_at, state, cohort, incident_id
    ) VALUES 
      ('rsk_test_001', 'A', 'cus_test_001', 'pay_test_001', 50000, 4500, 5000, 2250, ${now}, 'DETECTED', 'TREATMENT', NULL),
      ('rsk_test_outage', 'A', 'cus_test_001', 'pay_test_002', 50000, 5000, 5000, 2500, ${now}, 'DETECTED', 'TREATMENT', 'inc_test_01'),
      ('rsk_test_dispute', 'D', 'cus_test_001', 'inv_test_dispute', 2500000, 6000, 5000, 3000, ${now}, 'DETECTED', 'TREATMENT', NULL);

    INSERT INTO incidents (
      id, kind, gateway, issuer, method, window_start, window_end, detected_at, description, status, source
    ) VALUES (
      'inc_test_01', 'GATEWAY_DEGRADATION', 'razorpay', 'HDFC', 'UPI_AUTOPAY',
      ${now - 7200000}, ${now + 7200000}, ${now}, 'Simulated gateway degradation on HDFC', 'OPEN', 'DETECTOR'
    );
  `);

  return db;
}
