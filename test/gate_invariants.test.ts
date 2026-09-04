import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dispatchMockAdapter } from "../adapters";
import { gate, mintGatePassport, verifyGatePassport, getGatePassportSecret, type GatePassport } from "../engines/gate";
import { createTestDb } from "./setup";

describe("Gate Invariants & Non-Bypassability Security Proof", () => {
  const db = createTestDb();
  const now = Date.now();

  it("throws SecurityException when adapter is called without GatePassport", () => {
    const input = {
      riskItemId: "rsk_test_001",
      planStepId: "stp_test_001",
      customerId: "cus_test_001",
      customerName: "Aarav Sharma",
      phone: "+919876543210",
      email: "aarav@example.com",
      language: "EN" as const,
      segment: "B2C" as const,
      exposurePaise: 50000,
      rootCause: "INSUFFICIENT_FUNDS",
      playbook: "ONE_TAP_UPI",
      stepNo: 1,
      action: "SEND_WHATSAPP",
      scheduledAt: now,
      metadata: { channel: "WHATSAPP" },
    };

    expect(() => {
      dispatchMockAdapter(input);
    }).toThrow("SECURITY_ERROR");
  });

  it("throws SecurityException when forged or tampered passport signature is presented", () => {
    const forgedPassport: GatePassport = {
      passportId: "pass_forged_999",
      riskItemId: "rsk_test_001",
      planStepId: "stp_test_001",
      channel: "WHATSAPP",
      action: "SEND_WHATSAPP",
      issuedAt: now,
      expiresAt: now + 3600000,
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
    };

    const input = {
      riskItemId: "rsk_test_001",
      planStepId: "stp_test_001",
      customerId: "cus_test_001",
      customerName: "Aarav Sharma",
      phone: "+919876543210",
      email: "aarav@example.com",
      language: "EN" as const,
      segment: "B2C" as const,
      exposurePaise: 50000,
      rootCause: "INSUFFICIENT_FUNDS",
      playbook: "ONE_TAP_UPI",
      stepNo: 1,
      action: "SEND_WHATSAPP",
      scheduledAt: now,
      metadata: { channel: "WHATSAPP" },
    };

    expect(() => {
      dispatchMockAdapter(input, forgedPassport);
    }).toThrow("SECURITY_ERROR");
  });

  it("throws SecurityException when expired passport is presented", () => {
    const expiredPassport = mintGatePassport({
      riskItemId: "rsk_test_001",
      planStepId: "stp_test_001",
      channel: "WHATSAPP",
      action: "SEND_WHATSAPP",
      issuedAt: now - 5 * 3600 * 1000, // issued 5 hours ago (expires in 4h)
    });

    const input = {
      riskItemId: "rsk_test_001",
      planStepId: "stp_test_001",
      customerId: "cus_test_001",
      customerName: "Aarav Sharma",
      phone: "+919876543210",
      email: "aarav@example.com",
      language: "EN" as const,
      segment: "B2C" as const,
      exposurePaise: 50000,
      rootCause: "INSUFFICIENT_FUNDS",
      playbook: "ONE_TAP_UPI",
      stepNo: 1,
      action: "SEND_WHATSAPP",
      scheduledAt: now,
      metadata: { channel: "WHATSAPP" },
    };

    expect(() => {
      dispatchMockAdapter(input, expiredPassport);
    }).toThrow("SECURITY_ERROR");
  });

  it("allows execution when valid GatePassport minted by gate() is presented", () => {
    const dayTime = new Date("2026-08-20T14:00:00+05:30").getTime();
    const gateDec = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        customerId: "cus_test_001",
        channel: "WHATSAPP",
        action: "SEND_WHATSAPP",
        scheduledAt: dayTime,
      },
      { now: dayTime },
    );

    expect(gateDec.allowed).toBe(true);
    expect(gateDec.passport).toBeDefined();

    const input = {
      riskItemId: "rsk_test_001",
      planStepId: "stp_test_001",
      customerId: "cus_test_001",
      customerName: "Aarav Sharma",
      phone: "+919876543210",
      email: "aarav@example.com",
      language: "EN" as const,
      segment: "B2C" as const,
      exposurePaise: 50000,
      rootCause: "INSUFFICIENT_FUNDS",
      playbook: "ONE_TAP_UPI",
      stepNo: 1,
      action: "SEND_WHATSAPP",
      scheduledAt: dayTime,
      metadata: { channel: "WHATSAPP" },
    };

    const output = dispatchMockAdapter(input, gateDec.passport);
    expect(output.channel).toBe("WHATSAPP");
    expect(output.payload).toBeDefined();
  });

  it("enforces quiet hours boundary minutes strictly (07:59:59 blocked, 08:00:00 allowed)", () => {
    // 07:59:59 IST
    const morningJustBefore = new Date("2026-08-20T07:59:59+05:30").getTime();
    // 08:00:00 IST
    const morningOnTime = new Date("2026-08-20T08:00:00+05:30").getTime();

    const decBlocked = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        customerId: "cus_test_001",
        channel: "VOICE",
        action: "CALL",
        scheduledAt: morningJustBefore,
      },
      { now: morningJustBefore },
    );
    expect(decBlocked.allowed).toBe(false);
    expect(decBlocked.reasonCode).toBe("QUIET_HOURS_VOICE");

    const decAllowed = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        customerId: "cus_test_001",
        channel: "VOICE",
        action: "CALL",
        scheduledAt: morningOnTime,
      },
      { now: morningOnTime },
    );
    expect(decAllowed.allowed).toBe(true);
  });

  it("statically verifies that no adapter is imported outside execute.ts and test files", () => {
    const rootDir = join(import.meta.dir, "..");
    const enginesDir = join(rootDir, "engines");
    const engineFiles = readdirSync(enginesDir).filter((f) => f.endsWith(".ts"));

    for (const file of engineFiles) {
      if (file === "execute.ts") continue; // execute.ts is the authorized executor
      const content = readFileSync(join(enginesDir, file), "utf8");
      expect(content).not.toMatch(/from\s+["']\.\.\/adapters/);
      expect(content).not.toMatch(/formatVoiceTranscript|formatWhatsApp|formatSms|formatGatewayCharge/);
    }
  });

  it("throws SecurityException when GatePassport is reused for a different action", () => {
    const dayTime = new Date("2026-08-20T14:00:00+05:30").getTime();
    const gateDec = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        planStepId: "stp_test_001",
        customerId: "cus_test_001",
        channel: "WHATSAPP",
        action: "SEND_WHATSAPP",
        scheduledAt: dayTime,
      },
      { now: dayTime },
    );

    expect(gateDec.allowed).toBe(true);

    const inputMismatchAction = {
      riskItemId: "rsk_test_001",
      planStepId: "stp_test_001",
      customerId: "cus_test_001",
      customerName: "Aarav Sharma",
      phone: "+919876543210",
      email: "aarav@example.com",
      language: "EN" as const,
      segment: "B2C" as const,
      exposurePaise: 50000,
      rootCause: "INSUFFICIENT_FUNDS",
      playbook: "ONE_TAP_UPI",
      stepNo: 1,
      action: "UNAUTHORIZED_LEGAL_ESCALATION",
      scheduledAt: dayTime,
      metadata: { channel: "WHATSAPP" },
    };

    expect(() => {
      dispatchMockAdapter(inputMismatchAction, gateDec.passport);
    }).toThrow("SECURITY_ERROR");
  });

  it("throws SecurityException when GatePassport is reused for a different planStepId", () => {
    const dayTime = new Date("2026-08-20T14:00:00+05:30").getTime();
    const gateDec = gate(
      db,
      {
        riskItemId: "rsk_test_001",
        planStepId: "stp_test_001",
        customerId: "cus_test_001",
        channel: "WHATSAPP",
        action: "SEND_WHATSAPP",
        scheduledAt: dayTime,
      },
      { now: dayTime },
    );

    const inputMismatchStep = {
      riskItemId: "rsk_test_001",
      planStepId: "stp_different_999",
      customerId: "cus_test_001",
      customerName: "Aarav Sharma",
      phone: "+919876543210",
      email: "aarav@example.com",
      language: "EN" as const,
      segment: "B2C" as const,
      exposurePaise: 50000,
      rootCause: "INSUFFICIENT_FUNDS",
      playbook: "ONE_TAP_UPI",
      stepNo: 2,
      action: "SEND_WHATSAPP",
      scheduledAt: dayTime,
      metadata: { channel: "WHATSAPP" },
    };

    expect(() => {
      dispatchMockAdapter(inputMismatchStep, gateDec.passport);
    }).toThrow("SECURITY_ERROR");
  });

  it("statically verifies that adapters/index.ts does not export raw formatters", () => {
    const indexPath = join(import.meta.dir, "..", "adapters", "index.ts");
    const indexContent = readFileSync(indexPath, "utf8");
    expect(indexContent).not.toMatch(/export\s+\*\s+from\s+["']\.\/(email|sms|whatsapp|voice|gateway|payment_link)["']/);
    expect(indexContent).not.toMatch(/export\s+\{[^}]*formatEmail[^}]*\}/);
  });

  it("refuses to operate without GATE_PASSPORT_SECRET in production mode", () => {
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.GATE_PASSPORT_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.GATE_PASSPORT_SECRET;
      expect(() => {
        getGatePassportSecret();
      }).toThrow("[FATAL SECURITY INVARIANT]");
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origSecret) process.env.GATE_PASSPORT_SECRET = origSecret;
    }
  });
});
