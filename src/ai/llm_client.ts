import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  responseSchema?: Record<string, unknown>;
}

/**
 * A cache entry produced by a REAL LLM API call includes tokenUsage and the model version.
 * A cache entry produced by the offline classifier has model = "recoup-nlu-keyword-classifier-v1"
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
 * Gemini model preference order for this API key (free-tier).
 * gemini-3.5-flash-lite is fast, reliable, and within free-tier limits.
 * gemini-3.6-flash is secondary fallback.
 */
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

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

/** Sleep helper for rate-limit back-off */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Calls Gemini REST API with the given model.
 * Returns null on 429 / 404 / empty-candidates so the caller can try the next model.
 * Attempts with responseMimeType=json first; if Gemini returns empty candidates (safety block),
 * retries once in plain-text mode which is less restrictive.
 */
async function callGemini<T>(
  req: LlmRequest,
  model: string,
  apiKey: string,
  liveStart: number,
): Promise<{ parsed: T; content: string; model: string; tokenUsage?: LlmCacheEntry["tokenUsage"] } | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Try JSON mime type first, then plain text if candidates come back empty
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
        signal: AbortSignal.timeout(12000),
      });
    } catch (fetchErr) {
      console.warn(`[WARN] Gemini ${model} fetch failed or timed out: ${(fetchErr as Error).message}`);
      return null;
    }

    if (resp.status === 429) {
      console.warn(`[WARN] Gemini ${model} rate-limited (429) — backing off 3s...`);
      await sleep(3000);
      return null;
    }

    // 404 = model not available; 503 = overloaded — both fast-fail, try next model
    if (resp.status === 404 || resp.status === 503) {
      return null;
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.warn(`[WARN] Gemini ${model} error ${resp.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = (await resp.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
      error?: { message?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      modelVersion?: string;
    };

    // Detect API-level error embedded in a 200 body
    if (data.error?.message) {
      console.warn(`[WARN] Gemini ${model} API error: ${data.error.message.slice(0, 200)}`);
      return null;
    }

    // Detect safety block (empty candidates or explicit blockReason)
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) {
      console.warn(`[WARN] Gemini ${model} safety block: ${blockReason} — skipping this model`);
      return null;
    }

    const candidate = data.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text ?? "";

    if (!rawText) {
      if (useMimeType) {
        // Empty with JSON mime type — retry without it (less restrictive)
        console.warn(`[WARN] Gemini ${model} returned empty content (finishReason=${candidate?.finishReason}) — retrying in plain-text mode`);
        continue;
      }
      console.warn(`[WARN] Gemini ${model} returned empty content in both modes — skipping`);
      return null;
    }

    // Strip markdown code fences if Gemini wraps the JSON
    const cleanText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let parsed: T;
    try {
      parsed = JSON.parse(cleanText) as T;
    } catch {
      console.warn(`[WARN] Gemini ${model} returned non-JSON: ${cleanText.slice(0, 200)}`);
      return null;
    }

    const tokenUsage = data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined;

    return { parsed, content: cleanText, model: data.modelVersion ?? model, tokenUsage };
  }

  return null;
}


/**
 * Calls OpenRouter with a free-tier Gemini model as final fallback for persistent rate limits.
 * Requires OPENROUTER_API_KEY env var.
 */
async function callOpenRouter<T>(
  req: LlmRequest,
  liveStart: number,
): Promise<{ parsed: T; content: string; model: string; tokenUsage?: LlmCacheEntry["tokenUsage"] } | null> {
  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) return null;

  // Free-tier models on OpenRouter (no credits needed)
  const orModels = [
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-flash-1.5-8b-exp:free",
    "meta-llama/llama-3.1-8b-instruct:free",
  ];

  for (const orModel of orModels) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${orKey}`,
          "HTTP-Referer": "https://github.com/recoup-ai/recoup",
          "X-Title": "Recoup B2B NLU Benchmark",
        },
        body: JSON.stringify({
          model: orModel,
          messages: [
            { role: "system", content: req.systemPrompt },
            { role: "user", content: req.userPrompt },
          ],
          temperature: req.temperature ?? 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (resp.status === 429) { continue; }
      if (!resp.ok) { continue; }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const rawText = data.choices?.[0]?.message?.content ?? "{}";
      const cleanText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      const parsed = JSON.parse(cleanText) as T;
      const tokenUsage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined;

      return { parsed, content: cleanText, model: data.model ?? orModel, tokenUsage };
    } catch {
      continue;
    }
  }
  return null;
}

export function hasRuntimeApiKey(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENROUTER_API_KEY
  );
}

/**
 * Universal LLM Client with deterministic prompt-hash caching.
 *
 * Priority order:
 *   1. Real cache hit (isFallback !== true) when API key is present or in benchmark replay
 *   2. Live Gemini API (GEMINI_API_KEY) — gemini-3.6-flash → gemini-3.5-flash-lite
 *   3. OpenAI API (OPENAI_API_KEY) — gpt-4o-mini
 *   4. OpenRouter free tier (OPENROUTER_API_KEY) — on persistent rate limits
 *   5. Offline keyword-classifier fallback — only when BENCHMARK_STRICT !== "1"
 *
 * HONEST RUNTIME INVARIANT:
 *   If no API key is present at runtime (and not in benchmark strict cache-replay),
 *   llmUsed MUST be false and llmSkippedReason MUST be "no_api_key".
 */
export async function callStructuredLlm<T extends Record<string, unknown>>(
  req: LlmRequest,
  fallbackGenerator: () => T,
): Promise<LlmResponse<T>> {
  const promptHash = getPromptHash(req.systemPrompt, req.userPrompt);
  const cache = loadCache();
  const apiKeyPresent = hasRuntimeApiKey();

  // 1. Real cache hit (isFallback !== true) — allow deterministic replay from real LLM inference
  const cached = cache[promptHash];
  if (cached && !cached.isFallback) {
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

  // 2. If no real cache entry and no API key present at runtime:
  if (!apiKeyPresent) {
    // In benchmark strict mode with a cache miss, throw rather than self-scoring fallback
    if (STRICT_MODE) {
      throw new Error(
        `LLM_CACHE_MISS [${promptHash}]: No real cache entry and no API key set (GEMINI_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY).\n` +
        `In BENCHMARK_STRICT mode the offline classifier is suppressed to prevent self-scoring.`
      );
    }

    // In live execution path without an API key:
    // Honest disclosure: llmUsed is FALSE, llmSkippedReason is "no_api_key"
    const parsed = fallbackGenerator();
    const content = JSON.stringify(parsed);
    return {
      content,
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

  const liveStart = Date.now();

  // 2. Gemini API
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const result = await callGemini<T>(req, model, geminiKey, liveStart);
        if (result) {
          const latencyMs = Math.max(1, Date.now() - liveStart);
          const entry: LlmCacheEntry<T> = {
            model: result.model,
            parsed: result.parsed,
            content: result.content,
            cachedAt: Date.now(),
            inferredAt: new Date(liveStart).toISOString(),
            tokenUsage: result.tokenUsage,
            isFallback: false,
          };
          cache[promptHash] = entry as LlmCacheEntry;
          saveCache(cache);
          return {
            content: result.content,
            parsed: result.parsed,
            cached: false,
            model: result.model,
            promptHash,
            tokenUsage: result.tokenUsage,
            llmUsed: true,
            llmSkippedReason: null,
            latencyMs,
          };
        }
      } catch {
        // network error — try next
      }
    }
    console.warn("[WARN] All Gemini models exhausted — trying OpenRouter fallback...");
  }

  // 3. OpenAI API
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: req.systemPrompt },
            { role: "user", content: req.userPrompt },
          ],
          temperature: req.temperature ?? 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (resp.ok) {
        const latencyMs = Math.max(1, Date.now() - liveStart);
        const data = (await resp.json()) as {
          choices: Array<{ message: { content: string } }>;
          model: string;
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };
        const content = data.choices[0]?.message.content ?? "{}";
        const parsed = JSON.parse(content) as T;
        const tokenUsage = data.usage
          ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens }
          : undefined;

        const entry: LlmCacheEntry<T> = { model: data.model, parsed, content, cachedAt: Date.now(), inferredAt: new Date(liveStart).toISOString(), tokenUsage, isFallback: false };
        cache[promptHash] = entry as LlmCacheEntry;
        saveCache(cache);
        return {
          content,
          parsed,
          cached: false,
          model: data.model,
          promptHash,
          tokenUsage,
          llmUsed: true,
          llmSkippedReason: null,
          latencyMs,
        };
      }
    } catch {}
  }

  // 4. OpenRouter free-tier fallback
  try {
    const orResult = await callOpenRouter<T>(req, liveStart);
    if (orResult) {
      const latencyMs = Math.max(1, Date.now() - liveStart);
      const entry: LlmCacheEntry<T> = {
        model: orResult.model,
        parsed: orResult.parsed,
        content: orResult.content,
        cachedAt: Date.now(),
        inferredAt: new Date(liveStart).toISOString(),
        tokenUsage: orResult.tokenUsage,
        isFallback: false,
      };
      cache[promptHash] = entry as LlmCacheEntry;
      saveCache(cache);
      return {
        content: orResult.content,
        parsed: orResult.parsed,
        cached: false,
        model: orResult.model,
        promptHash,
        tokenUsage: orResult.tokenUsage,
        llmUsed: true,
        llmSkippedReason: null,
        latencyMs,
      };
    }
  } catch {}

  // 5. Offline keyword-classifier fallback
  if (STRICT_MODE) {
    throw new Error(
      `LLM_CACHE_MISS [${promptHash}]: No cache entry and all live providers failed.\n` +
      `Set GEMINI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY to populate real cache entries.\n` +
      `In BENCHMARK_STRICT mode the offline classifier is suppressed.`
    );
  }

  const latencyMs = Math.max(1, Date.now() - liveStart);
  console.warn(
    `[WARN] LLM_FALLBACK_USED [${promptHash.slice(0, 12)}…]: All live providers unavailable. ` +
    `Using offline keyword classifier. This result is NOT LLM inference.`
  );

  const parsed = fallbackGenerator();
  const content = JSON.stringify(parsed);
  const entry: LlmCacheEntry<T> = {
    model: "recoup-nlu-keyword-classifier-v1",
    parsed,
    content,
    cachedAt: Date.now(),
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
    llmSkippedReason: "providers_unavailable",
    latencyMs,
  };
}
