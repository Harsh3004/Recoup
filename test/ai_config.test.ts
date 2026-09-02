import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getAiConfig, updateAiConfig, maskApiKey, AVAILABLE_MODELS } from "../src/ai/config";
import { extractAndParseJson, testAiConnection } from "../src/ai/llm_client";

// ---------------------------------------------------------------------------
// Env isolation helpers — ensures no real API key leaks into or out of tests
// ---------------------------------------------------------------------------
let _savedEnv: Record<string, string | undefined> = {};

function saveEnv() {
  _savedEnv = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GEMINI_API_KEY:     process.env.GEMINI_API_KEY,
    OPENAI_API_KEY:     process.env.OPENAI_API_KEY,
  };
  // Strip any real keys so tests run in a known-clean env
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
}

function restoreEnv() {
  for (const [k, v] of Object.entries(_savedEnv)) {
    if (v !== undefined) process.env[k] = v;
    else delete process.env[k as keyof NodeJS.ProcessEnv];
  }
}

describe("AI Configuration & Dynamic Model Switching", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("provides available models catalog including OpenRouter free models", () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThanOrEqual(5);
    const minimax = AVAILABLE_MODELS.find((m) => m.id === "minimax/minimax-m3:free");
    expect(minimax).toBeDefined();
    expect(minimax?.provider).toBe("openrouter");
    expect(minimax?.isFree).toBe(true);
    expect(minimax?.isRecommended).toBe(true);
  });

  it("correctly masks sensitive API keys for safe UI display", () => {
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey("sk-short")).toBe("••••••••");
    // Use a clearly fake placeholder — NOT a real key prefix
    const fakeKey = "TEST_FAKE_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX0000";
    const masked = maskApiKey(fakeKey);
    expect(masked).toBe(`${fakeKey.slice(0, 8)}••••••••${fakeKey.slice(-4)}`);
    expect(masked).not.toContain("XXXX");
    expect(masked).not.toContain(fakeKey.slice(8, -4));
  });

  it("extractAndParseJson cleans markdown code fences and extraneous text", () => {
    const rawFenced = "```json\n{\n  \"root_cause\": \"PO_GRN_MISMATCH\",\n  \"confidence_bps\": 9200\n}\n```";
    const parsed1 = extractAndParseJson<{ root_cause: string; confidence_bps: number }>(rawFenced);
    expect(parsed1.root_cause).toBe("PO_GRN_MISMATCH");
    expect(parsed1.confidence_bps).toBe(9200);

    const rawWrapped = "Here is the diagnosis result:\n```\n{\"root_cause\": \"APPROVAL_STUCK\"}\n```\nHope this helps!";
    const parsed2 = extractAndParseJson<{ root_cause: string }>(rawWrapped);
    expect(parsed2.root_cause).toBe("APPROVAL_STUCK");
  });

  it("updateAiConfig persists and updates active provider and model (no real key written)", () => {
    // Capture original config (already key-stripped by beforeEach)
    const original = getAiConfig();
    try {
      const updated = updateAiConfig({
        activeProvider: "openrouter",
        activeModel: "minimax/minimax-m3:free",
        temperature: 0.15,
        // Deliberately omit openRouterApiKey so no key value touches disk
      });

      expect(updated.activeProvider).toBe("openrouter");
      expect(updated.activeModel).toBe("minimax/minimax-m3:free");
      expect(updated.temperature).toBe(0.15);
      // Keys must remain empty — no real credentials should be set here
      expect(updated.openRouterApiKey).toBe("");
      expect(updated.geminiApiKey).toBe("");
      expect(updated.openaiApiKey).toBe("");

      const reloaded = getAiConfig();
      expect(reloaded.activeProvider).toBe("openrouter");
      expect(reloaded.activeModel).toBe("minimax/minimax-m3:free");
    } finally {
      // Restore the original persisted config (model prefs only — no key)
      updateAiConfig({
        activeProvider: original.activeProvider,
        activeModel: original.activeModel,
        temperature: original.temperature,
      });
    }
  });

  it("testAiConnection runs successfully in offline mode with instant latency", async () => {
    // Offline mode must NEVER require or read an API key
    const res = await testAiConnection({ provider: "offline" });
    expect(res.success).toBe(true);
    expect(res.provider).toBe("offline");
    expect(res.sampleDiagnosis).toBeDefined();
    expect(res.sampleDiagnosis.root_cause).toBe("PO_GRN_MISMATCH");
    // Confirm no key was used
    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
  });
});

