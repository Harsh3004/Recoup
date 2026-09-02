import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { getAiConfig, AVAILABLE_MODELS, type AiConfig, type AiProvider } from "./config";

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

/**
 * Cache entry written to disk (data/llm_cache.json).
 * Distinguishes genuine LLM inference results from offline-fallback results via model name
 * and isFallback: true. These are intentionally distinguishable.
 */
export interface LlmCacheEntry<T = Record<string, unknown>> {
  model: string;
  parsed: T;
  content: string;
  cachedAt: number;
  inferredAt?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  isFallback?: boolean;
}

export interface LlmResponse<T = Record<string, unknown>> {
  content: string;
  parsed: T;
  cached: boolean;
  model: string;
  promptHash: string;
  fallbackUsed?: boolean;
  llmUsed: boolean;
  llmSkippedReason?: string | null;
  latencyMs?: number;
  tokenUsage?: LlmCacheEntry["tokenUsage"];
}

const CACHE_FILE = join(import.meta.dir, "..", "..", "data", "llm_cache.json");

/** BENCHMARK_STRICT=1 → throw on cache miss instead of running the offline classifier */
const STRICT_MODE = process.env.BENCHMARK_STRICT === "1";

/**
 * Gemini model preference order for this API key.
 */
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

let geminiRateLimitUntil = 0;

function getPromptHash(systemPrompt: string, userPrompt: string): string {
  return createHash("sha256").update(`${systemPrompt}\n---\n${userPrompt}`).digest("hex").slice(0, 32);
}

function loadCache(): Record<string, LlmCacheEntry> {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, LlmCacheEntry>;
    }
  } catch {}
  return {};
}

function saveCache(cache: Record<string, LlmCacheEntry>): void {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch {}
}

/** Robust JSON parser that handles markdown code blocks and wrapping text */
export function extractAndParseJson<T>(rawText: string): T {
  let cleanText = (rawText || "").trim();
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleanText = fenceMatch[1].trim();
  }
  // If there is still extra preamble or postamble, extract between first { and last }
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    cleanText = cleanText.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleanText) as T;
}

/**
 * Calls OpenRouter REST API with the given model (defaults to minimax/minimax-m3:free).
 */
let openRouterRateLimitUntil = 0;

export async function callOpenRouter<T>(
  req: LlmRequest,
  liveStart: number,
  overrideModel?: string,
  overrideApiKey?: string,
): Promise<{ parsed: T; content: string; model: string; tokenUsage?: LlmCacheEntry["tokenUsage"] } | null> {
  if (Date.now() < openRouterRateLimitUntil) {
    return null;
  }
  const config = getAiConfig();
  const orKey = overrideApiKey || config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
  if (!orKey) return null;

  const model = overrideModel || (config.activeProvider === "openrouter" ? config.activeModel : null) || "minimax/minimax-m3:free";

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${orKey}`,
        "HTTP-Referer": "https://github.com/recoup-ai/recoup",
        "X-Title": "Recoup Autonomous Recovery",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${req.systemPrompt}\nIMPORTANT: Respond ONLY with a valid JSON object matching the requested schema. No conversational preamble.` },
          { role: "user", content: req.userPrompt },
        ],
        temperature: req.temperature ?? config.temperature ?? 0.1,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (resp.status === 429) {
      openRouterRateLimitUntil = Date.now() + 60_000;
      console.warn(`[WARN] OpenRouter ${model} rate-limited (429) — tripping 60s circuit breaker...`);
      return null;
    }
    if (!resp.ok) {
      return null;
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const rawText = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = extractAndParseJson<T>(rawText);
    const tokenUsage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;

    return { parsed, content: rawText, model: data.model ?? model, tokenUsage };
  } catch {
    return null;
  }
}

/**
 * Calls Gemini REST API with the given model.
 */
async function callGemini<T>(
  req: LlmRequest,
  model: string,
  apiKey: string,
  liveStart: number,
): Promise<{ parsed: T; content: string; model: string; tokenUsage?: LlmCacheEntry["tokenUsage"] } | null> {
  if (Date.now() < geminiRateLimitUntil) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  for (const useMimeType of [true, false]) {
    const body = {
      system_instruction: { parts: [{ text: req.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: req.userPrompt }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        ...(useMimeType ? { responseMimeType: "application/json" } : {}),
      },
    };

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
    } catch (fetchErr) {
      return null;
    }

    if (resp.status === 429) {
      geminiRateLimitUntil = Date.now() + 60_000;
      console.warn(`[WARN] Gemini ${model} rate-limited (429) — tripping 60s circuit breaker...`);
      return null;
    }

    if (resp.status === 404 || resp.status === 503 || !resp.ok) {
      return null;
    }

    const data = (await resp.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      modelVersion?: string;
    };

    const candidate = data.candidates?.[0];
    if (!candidate) continue;

    const rawText = candidate.content?.parts?.[0]?.text ?? "";
    if (!rawText.trim()) continue;

    try {
      const parsed = extractAndParseJson<T>(rawText);
      const tokenUsage = data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount ?? 0,
            completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: data.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined;

      return { parsed, content: rawText, model: data.modelVersion ?? model, tokenUsage };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Calls OpenAI REST API
 */
async function callOpenAi<T>(
  req: LlmRequest,
  apiKey: string,
  model: string = "gpt-4o-mini",
): Promise<{ parsed: T; content: string; model: string; tokenUsage?: LlmCacheEntry["tokenUsage"] } | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${req.systemPrompt}\nRespond in JSON.` },
          { role: "user", content: req.userPrompt },
        ],
        temperature: req.temperature ?? 0.1,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    const content = data.choices[0]?.message.content ?? "{}";
    const parsed = extractAndParseJson<T>(content);
    const tokenUsage = data.usage
      ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens }
      : undefined;

    return { parsed, content, model: data.model, tokenUsage };
  } catch {
    return null;
  }
}

export function hasRuntimeApiKey(): boolean {
  const config = getAiConfig();
  return Boolean(
    config.openRouterApiKey ||
    config.geminiApiKey ||
    config.openaiApiKey ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY,
  );
}

/**
 * Universal LLM Client with deterministic prompt-hash caching and dynamic provider routing.
 */
export async function callStructuredLlm<T extends Record<string, unknown>>(
  req: LlmRequest,
  fallbackGenerator: () => T,
): Promise<LlmResponse<T>> {
  const promptHash = getPromptHash(req.systemPrompt, req.userPrompt);
  const cache = loadCache();
  const config = getAiConfig();

  // 1. Invariant: If no API key is present at runtime (and not in benchmark strict replay),
  // llmUsed MUST be false and llmSkippedReason MUST be "no_api_key".
  if (!hasRuntimeApiKey()) {
    if (STRICT_MODE) {
      const cached = cache[promptHash];
      if (cached && !cached.isFallback && config.enableCache) {
        return {
          content: cached.content ?? JSON.stringify(cached.parsed),
          parsed: cached.parsed as T,
          cached: true,
          model: cached.model,
          promptHash,
          tokenUsage: cached.tokenUsage,
          llmUsed: true,
          llmSkippedReason: null,
          latencyMs: 1,
        };
      }
      throw new Error(
        `LLM_CACHE_MISS [${promptHash}]: No real cache entry and no API key configured.\n` +
        `In BENCHMARK_STRICT mode the offline classifier is suppressed to prevent self-scoring.`,
      );
    }

    const parsed = fallbackGenerator();
    return {
      content: JSON.stringify(parsed),
      parsed,
      cached: false,
      model: "recoup-nlu-keyword-classifier-v1",
      promptHash,
      fallbackUsed: true,
      llmUsed: false,
      llmSkippedReason: "no_api_key",
      latencyMs: 0,
    };
  }

  // 2. Cache hit when key is present, or cached fallback when circuit breaker is active
  const cached = cache[promptHash];
  const inCircuitBreaker = (Date.now() < openRouterRateLimitUntil) || (Date.now() < geminiRateLimitUntil);
  if (cached && config.enableCache) {
    if (!cached.isFallback || inCircuitBreaker || config.activeProvider === "offline") {
      return {
        content: cached.content ?? JSON.stringify(cached.parsed),
        parsed: cached.parsed as T,
        cached: true,
        model: cached.model,
        promptHash,
        tokenUsage: cached.tokenUsage,
        llmUsed: !cached.isFallback,
        llmSkippedReason: cached.isFallback ? "circuit_breaker_active" : null,
        latencyMs: 1,
      };
    }
  }

  // 3. If user explicitly selected manual offline mode in UI settings (even with key present):
  if (config.activeProvider === "offline") {
    const parsed = fallbackGenerator();
    return {
      content: JSON.stringify(parsed),
      parsed,
      cached: false,
      model: "recoup-offline-rules-v1",
      promptHash,
      fallbackUsed: true,
      llmUsed: false,
      llmSkippedReason: "manual_offline_mode",
      latencyMs: 0,
    };
  }

  const liveStart = Date.now();
  let liveResult: { parsed: T; content: string; model: string; tokenUsage?: LlmCacheEntry["tokenUsage"] } | null = null;

  // 3. Provider Routing based on active configuration
  const openRouterKey = config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
  const geminiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  const openaiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;

  if (config.activeProvider === "openrouter" && openRouterKey) {
    // Primary: OpenRouter with Minimax M3 (or configured model)
    liveResult = await callOpenRouter<T>(req, liveStart, config.activeModel, openRouterKey);
  } else if (config.activeProvider === "gemini" && geminiKey) {
    // Primary: Google Gemini Direct
    for (const m of GEMINI_MODELS) {
      liveResult = await callGemini<T>(req, m, geminiKey, liveStart);
      if (liveResult) break;
    }
  } else if (config.activeProvider === "openai" && openaiKey) {
    // Primary: OpenAI Direct
    liveResult = await callOpenAi<T>(req, openaiKey, config.openaiModel || "gpt-4o-mini");
  }

  // 4. Cascading Fallback if primary provider was unavailable
  if (!liveResult) {
    if (openRouterKey && config.activeProvider !== "openrouter") {
      liveResult = await callOpenRouter<T>(req, liveStart, "minimax/minimax-m3:free", openRouterKey);
    }
    if (!liveResult && geminiKey && config.activeProvider !== "gemini") {
      for (const m of GEMINI_MODELS) {
        liveResult = await callGemini<T>(req, m, geminiKey, liveStart);
        if (liveResult) break;
      }
    }
    if (!liveResult && openaiKey && config.activeProvider !== "openai") {
      liveResult = await callOpenAi<T>(req, openaiKey, "gpt-4o-mini");
    }
  }

  // 5. Successful Live Inference — write to cache and return
  if (liveResult) {
    const latencyMs = Math.max(1, Date.now() - liveStart);
    const entry: LlmCacheEntry<T> = {
      model: liveResult.model,
      parsed: liveResult.parsed,
      content: liveResult.content,
      cachedAt: Date.now(),
      inferredAt: new Date(liveStart).toISOString(),
      tokenUsage: liveResult.tokenUsage,
      isFallback: false,
    };
    cache[promptHash] = entry as LlmCacheEntry;
    saveCache(cache);

    return {
      content: liveResult.content,
      parsed: liveResult.parsed,
      cached: false,
      model: liveResult.model,
      promptHash,
      tokenUsage: liveResult.tokenUsage,
      llmUsed: true,
      llmSkippedReason: null,
      latencyMs,
    };
  }

  // 6. Offline keyword-classifier fallback if all live providers failed
  if (STRICT_MODE) {
    throw new Error(
      `LLM_PROVIDER_EXHAUSTED [${promptHash}]: Configured models returned empty/rate-limited.\n` +
      `In BENCHMARK_STRICT mode the offline classifier is suppressed to prevent self-scoring.`,
    );
  }

  console.warn(`[WARN] LLM_FALLBACK_USED [${promptHash.slice(0, 12)}…]: Providers unavailable. Using offline rule classifier.`);
  const parsed = fallbackGenerator();
  const content = JSON.stringify(parsed);

  const entry: LlmCacheEntry<T> = {
    model: "recoup-nlu-keyword-classifier-v1",
    parsed,
    content,
    cachedAt: Date.now(),
    inferredAt: new Date(liveStart).toISOString(),
    isFallback: true,
  };
  cache[promptHash] = entry as LlmCacheEntry;
  saveCache(cache);

  return {
    content,
    parsed,
    cached: false,
    model: "recoup-nlu-keyword-classifier-v1",
    promptHash,
    fallbackUsed: true,
    llmUsed: false,
    llmSkippedReason: "all_providers_exhausted",
    latencyMs: Date.now() - liveStart,
  };
}

/**
 * Diagnostic test function for testing model connections from the UI or CLI.
 */
export async function testAiConnection(options?: {
  provider?: AiProvider;
  model?: string;
  apiKey?: string;
}): Promise<{
  success: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  sampleDiagnosis?: any;
  error?: string;
}> {
  const config = getAiConfig();
  const provider = options?.provider || config.activeProvider;
  const model = options?.model || config.activeModel;
  const startTime = Date.now();

  const testReq: LlmRequest = {
    systemPrompt: `You are Recoup's accounts payable invoice root-cause diagnostic engine.
Diagnose the given dispute and return ONLY a JSON object with:
{"root_cause": "PO_GRN_MISMATCH" | "INVOICE_NOT_RECEIVED" | "APPROVAL_STUCK" | "LINE_ITEM_DISPUTE" | "CASH_CRUNCH", "confidence_bps": number, "evidence_spans": string[], "recommended_playbook": string, "rationale": string}`,
    userPrompt: `Invoice: INV-TEST-001 | Exposure: ₹1,50,000 | Ageing: 35 days | Dispute: "Warehouse supervisor rejected the delivery because packing slip was missing. Need inward gate pass before finance releases payment."`,
  };

  try {
    if (provider === "openrouter") {
      const key = options?.apiKey || config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error("Missing OpenRouter API Key.");
      const res = await callOpenRouter(testReq, startTime, model, key);
      if (!res) throw new Error(`Model ${model} returned empty response or rate limit.`);
      return {
        success: true,
        provider: "openrouter",
        model: res.model,
        latencyMs: Date.now() - startTime,
        tokenUsage: res.tokenUsage,
        sampleDiagnosis: res.parsed,
      };
    }

    if (provider === "gemini") {
      const key = options?.apiKey || config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error("Missing Gemini API Key.");
      const res = await callGemini(testReq, model || "gemini-2.5-flash", key, startTime);
      if (!res) throw new Error(`Gemini model ${model} failed or is rate-limited.`);
      return {
        success: true,
        provider: "gemini",
        model: res.model,
        latencyMs: Date.now() - startTime,
        tokenUsage: res.tokenUsage,
        sampleDiagnosis: res.parsed,
      };
    }

    if (provider === "openai") {
      const key = options?.apiKey || config.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!key) throw new Error("Missing OpenAI API Key.");
      const res = await callOpenAi(testReq, key, model || "gpt-4o-mini");
      if (!res) throw new Error(`OpenAI model ${model} failed.`);
      return {
        success: true,
        provider: "openai",
        model: res.model,
        latencyMs: Date.now() - startTime,
        tokenUsage: res.tokenUsage,
        sampleDiagnosis: res.parsed,
      };
    }

    // Offline test
    return {
      success: true,
      provider: "offline",
      model: "recoup-offline-rules-v1",
      latencyMs: 1,
      sampleDiagnosis: {
        root_cause: "PO_GRN_MISMATCH",
        confidence_bps: 9500,
        evidence_spans: ["Warehouse supervisor rejected the delivery", "packing slip was missing"],
        recommended_playbook: "AP_PORTAL_MATCH",
        rationale: "Deterministic domain regex identified missing packing slip and warehouse inward rejection.",
      },
    };
  } catch (err: any) {
    return {
      success: false,
      provider,
      model,
      latencyMs: Date.now() - startTime,
      error: err.message || String(err),
    };
  }
}
