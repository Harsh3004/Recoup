import { describe, expect, it } from "bun:test";
import { verifyChain } from "../engines/audit";
import { appendAudit } from "../src/audit";
import { createTestDb } from "./setup";

describe("Audit Ledger Immutability & Tamper Detection Proof", () => {
  it("triggers abort on any attempt to UPDATE audit_events", () => {
    const db = createTestDb();
    const ev = appendAudit(db, {
      actor: "AGENT",
      action: "TEST_ACTION",
      entityType: "test",
      entityId: "test_01",
      decision: "ALLOW",
      reasonCodes: ["TEST"],
      ts: Date.now(),
    });

    expect(() => {
      db.query(`UPDATE audit_events SET decision = 'FORGED_DECISION' WHERE id = ?`).run(ev.id);
    }).toThrow("audit_events is append-only");
  });

  it("triggers abort on any attempt to DELETE from audit_events", () => {
    const db = createTestDb();
    const ev = appendAudit(db, {
      actor: "AGENT",
      action: "TEST_ACTION",
      entityType: "test",
      entityId: "test_02",
      decision: "ALLOW",
      reasonCodes: ["TEST"],
      ts: Date.now(),
    });

    expect(() => {
      db.query(`DELETE FROM audit_events WHERE id = ?`).run(ev.id);
    }).toThrow("audit_events is append-only");
  });

  it("validates 100% cryptographic integrity on an untampered hash chain", () => {
    const db = createTestDb();
    for (let i = 1; i <= 20; i++) {
      appendAudit(db, {
        actor: "AGENT",
        action: `EVENT_${i}`,
        entityType: "test",
        entityId: `test_${i}`,
        decision: "OK",
        reasonCodes: [`STEP_${i}`],
        ts: Date.now() + i * 1000,
      });
    }

    const verification = verifyChain(db);
    expect(verification.valid).toBe(true);
    expect(verification.totalEvents).toBe(20);
    expect(verification.headSeq).toBe(20);
  });
});
