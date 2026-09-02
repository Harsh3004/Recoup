export type SurfaceId = '' | 'A' | 'B' | 'C' | 'D';

export interface OverviewData {
  headline: {
    totalCases: number;
    treatmentCases: number;
    holdoutCases: number;
    totalExposureInr: number;
    treatmentRecoveredInr: number;
    scaledHoldoutBaselineInr: number;
    incrementalRecoveredInr: number;
    incrementalLiftPct: number;
    ci95: {
      lowerInr: number;
      upperInr: number;
      lowerLiftPct: number;
      upperLiftPct: number;
    };
    commsSent: number;
    gateAllowed: number;
    gateSuppressed: number;
    auditEventsChained: number;
    chainValid: boolean;
  };
  counterfactuals: {
    pureHoldout: {
      grossInr: number;
      netInr: number;
    };
    naiveDunning: {
      grossInr: number;
      costInr: number;
      netInr: number;
    };
    recoupEngine: {
      grossInr: number;
      costInr: number;
      netInr: number;
      incrementalOverNaiveInr: number;
    };
  };
  bySurface: Record<string, {
    totalExposurePaise: number;
    treatmentRecoveredPaise: number;
    holdoutRecoveredPaise: number;
    scaledHoldoutBaselinePaise: number;
    incrementalRecoveredPaise: number;
    liftPct: number;
    casesCount: number;
  }>;
  bySegment?: Record<string, any>;
  byPlaybook?: Record<string, any>;
  gateSuppressions?: Array<{
    allowed: number;
    reason_code: string;
    count: number;
  }>;
}

export interface CaseSummary {
  riskItemId: string;
  surface: string;
  customerId: string;
  customerName: string;
  segment: string;
  exposurePaise: number;
  exposureInr: number;
  rootCause: string;
  playbook: string;
  state: string;
  cohort: 'TREATMENT' | 'HOLDOUT';
  recoveredPaise: number;
  recoveredInr: number;
  resolvedVia?: string | null;
}

export interface CasesResponse {
  cases: CaseSummary[];
  total: number;
  showing: number;
}

export interface CaseDetail {
  riskItemId: string;
  surface: string;
  customerId: string;
  customerName: string;
  segment: string;
  exposurePaise: number;
  state: string;
  cohort: string;
  riskScore: number;
  pLossBps: number;
  urgencyBps: number;
  firstSeenAt: number;
  resolvedVia?: string | null;
  recoveredPaise?: number;
  diagnosis?: {
    rootCause: string;
    confidenceBps: number;
    evidenceSpans: string[];
    recommendedPlaybook: string;
    rationale: string;
    model: string;
    llmUsed: boolean;
    llmSkippedReason: string | null;
    latencyMs: number | null;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  } | null;
  policy?: {
    playbook: string;
    expectedValuePaise: number;
    reasoning: string;
    steps: Array<{
      stepOrder: number;
      channel: string;
      action: string;
      scheduledAt: number;
      status: string;
      executedAt?: number | null;
    }>;
  } | null;
  gateDecisions?: Array<{
    id: string;
    allowed: boolean;
    reasonCodes: string[];
    passportSignature: string | null;
    evaluatedAt: number;
    stepOrder: number;
    channel: string;
    action: string;
  }>;
  communications?: Array<{
    id: string;
    channel: string;
    action: string;
    payloadText: string;
    sentAt: number;
    deliveryStatus: string;
    customerReplied: boolean;
    replyText?: string | null;
  }>;
  auditTrail?: Array<{
    seq: number;
    eventId: string;
    action: string;
    actor: string;
    decision: string;
    reasonCodes?: string[] | string | null;
    timestamp: number;
    prevHash: string;
    hash: string;
    inputsDigest?: string;
  }>;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: 'openrouter' | 'gemini' | 'openai' | 'offline';
  isFree: boolean;
  isRecommended?: boolean;
  description: string;
}

export interface AiConfigData {
  activeProvider: 'openrouter' | 'gemini' | 'openai' | 'offline';
  activeModel: string;
  temperature: number;
  openRouterApiKeyMasked: string;
  geminiApiKeyMasked: string;
  openaiApiKeyMasked: string;
  hasOpenRouterKey: boolean;
  hasGeminiKey: boolean;
  hasOpenaiKey: boolean;
  availableModels: ModelOption[];
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
