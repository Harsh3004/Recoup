import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export type AiProvider = "openrouter" | "gemini" | "openai" | "offline";

export interface ModelOption {
  id: string;
  name: string;
  provider: AiProvider;
  isFree: boolean;
  isRecommended?: boolean;
  description: string;
}

export interface AiConfig {
  activeProvider: AiProvider;
  activeModel: string;
  openRouterApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  temperature: number;
  timeoutMs: number;
  enableCache: boolean;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "minimax/minimax-m3:free",
    name: "MiniMax M3 (Free)",
    provider: "openrouter",
    isFree: true,
    isRecommended: true,
    description: "Ultra-fast reasoning model via OpenRouter Free Tier with generous rate limits.",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash Exp (Free)",
    provider: "openrouter",
    isFree: true,
    description: "Google's experimental next-gen multimodal Flash model on OpenRouter.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B Instruct (Free)",
    provider: "openrouter",
    isFree: true,
    description: "Meta's flagship open-weights 70B model for complex instruction following.",
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B Instruct (Free)",
    provider: "openrouter",
    isFree: true,
    description: "High-efficiency 7B model tuned for fast JSON parsing.",
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 (Free)",
    provider: "openrouter",
    isFree: true,
    description: "Open-weights reasoning model with chain-of-thought verification.",
  },
  {
    id: "gemini-2.5-flash",
    name: "Google Gemini 2.5 Flash",
    provider: "gemini",
    isFree: false,
    description: "Google AI Studio direct API endpoint.",
  },
  {
    id: "gemini-2.0-flash",
    name: "Google Gemini 2.0 Flash",
    provider: "gemini",
    isFree: false,
    description: "Google AI Studio direct 2.0 Flash endpoint.",
  },
  {
    id: "gpt-4o-mini",
    name: "OpenAI GPT-4o Mini",
    provider: "openai",
    isFree: false,
    description: "Direct OpenAI API endpoint.",
  },
  {
    id: "recoup-offline-rules-v1",
    name: "Offline Rule Classifier (No API Key)",
    provider: "offline",
    isFree: true,
    description: "Deterministic domain regex heuristics with zero network calls.",
  },
];

const CONFIG_FILE = join(import.meta.dir, "..", "..", "data", "ai_config.json");

/**
 * Loads AI configuration:
 * - Model, provider, temperature preferences stored in data/ai_config.json
 * - Secret credentials strictly resolved from runtime environment (process.env)
 */
export function getAiConfig(): AiConfig {
  let fileConfig: Partial<AiConfig> = {};
  try {
    if (existsSync(CONFIG_FILE)) {
      fileConfig = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch {}

  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  // Determine default provider
  let defaultProvider: AiProvider = "openrouter";
  if (fileConfig.activeProvider) {
    defaultProvider = fileConfig.activeProvider;
  } else if (openRouterKey) {
    defaultProvider = "openrouter";
  } else if (geminiKey) {
    defaultProvider = "gemini";
  } else if (openaiKey) {
    defaultProvider = "openai";
  } else {
    defaultProvider = "offline";
  }

  const defaultModel =
    fileConfig.activeModel ||
    (defaultProvider === "openrouter"
      ? "minimax/minimax-m3:free"
      : defaultProvider === "gemini"
        ? "gemini-2.5-flash"
        : defaultProvider === "openai"
          ? "gpt-4o-mini"
          : "recoup-offline-rules-v1");

  return {
    activeProvider: defaultProvider,
    activeModel: defaultModel,
    openRouterApiKey: openRouterKey,
    geminiApiKey: geminiKey,
    openaiApiKey: openaiKey,
    temperature: fileConfig.temperature ?? 0.1,
    timeoutMs: fileConfig.timeoutMs ?? 8000,
    enableCache: fileConfig.enableCache ?? true,
  };
}

/**
 * Updates runtime and persisted AI configuration.
 * Credentials update process.env; model preferences persist to data/ai_config.json.
 */
export function updateAiConfig(newConfig: Partial<AiConfig>): AiConfig {
  if (newConfig.openRouterApiKey !== undefined) {
    process.env.OPENROUTER_API_KEY = newConfig.openRouterApiKey;
  }
  if (newConfig.geminiApiKey !== undefined) {
    process.env.GEMINI_API_KEY = newConfig.geminiApiKey;
  }
  if (newConfig.openaiApiKey !== undefined) {
    process.env.OPENAI_API_KEY = newConfig.openaiApiKey;
  }

  const current = getAiConfig();
  const toPersist = {
    activeProvider: newConfig.activeProvider ?? current.activeProvider,
    activeModel: newConfig.activeModel ?? current.activeModel,
    temperature: newConfig.temperature ?? current.temperature,
    timeoutMs: newConfig.timeoutMs ?? current.timeoutMs,
    enableCache: newConfig.enableCache ?? current.enableCache,
  };

  try {
    mkdirSync(dirname(CONFIG_FILE), { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(toPersist, null, 2), "utf8");
  } catch (err) {
    console.error("[ERROR] Failed to persist data/ai_config.json:", err);
  }

  return getAiConfig();
}

/**
 * Masks an API key for safe UI display (e.g. sk-or-v1-••••••••667b)
 */
export function maskApiKey(key?: string): string {
  if (!key || key.trim().length === 0) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "••••••••";
  const prefix = trimmed.slice(0, 8);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}
