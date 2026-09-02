import { describe, it, expect } from "bun:test";
import { getAiConfig, updateAiConfig, maskApiKey, AVAILABLE_MODELS } from "../src/ai/config";
import { extractAndParseJson, testAiConnection } from "../src/ai/llm_client";

describe("AI Configuration & Dynamic Model Switching", () => {
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
    // Use a clearly fake placeholder key — NOT a real OpenRouter key
    const fakeKey = "TEST_FAKE_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX0000";
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

  it("updateAiConfig persists and updates active provider and model", () => {
    const original = getAiConfig();
    try {
      const updated = updateAiConfig({
        activeProvider: "openrouter",
        activeModel: "minimax/minimax-m3:free",
        temperature: 0.15,
      });

      expect(updated.activeProvider).toBe("openrouter");
      expect(updated.activeModel).toBe("minimax/minimax-m3:free");
      expect(updated.temperature).toBe(0.15);

      const reloaded = getAiConfig();
      expect(reloaded.activeProvider).toBe("openrouter");
      expect(reloaded.activeModel).toBe("minimax/minimax-m3:free");
    } finally {
      updateAiConfig(original);
    }
  });

  it("testAiConnection runs successfully in offline mode with instant latency", async () => {
    const res = await testAiConnection({ provider: "offline" });
    expect(res.success).toBe(true);
    expect(res.provider).toBe("offline");
    expect(res.sampleDiagnosis).toBeDefined();
    expect(res.sampleDiagnosis.root_cause).toBe("PO_GRN_MISMATCH");
  });
});
