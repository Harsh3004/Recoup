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
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CaseDetail {
  riskItemId: string;
  surface: string;
  customerId: string;
  customerName: string;
  segment?: string;
  customerSegment?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerLanguage?: string;
  exposurePaise: number;
  state?: string;
  currentState?: string;
  cohort: string;
  riskScore?: number;
  pLossBps?: number;
  urgencyBps?: number;
  firstSeenAt?: number;
  resolvedVia?: string | null;
  recoveredPaise?: number;
  totalRecoveredPaise?: number;
  incidentId?: string | null;
  paymentLinkUrl?: string | null;
  diagnosis?: {
    rootCause: string;
    confidenceBps: number;
    isSystemic?: boolean;
    evidenceSpans?: string[];
    evidence?: string[];
    recommendedPlaybook?: string;
    rationale?: string;
    model?: string;
    llmUsed?: boolean;
    llmSkippedReason?: string | null;
    latencyMs?: number | null;
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  } | null;
  policy?: {
    playbook: string;
    expectedValuePaise: number;
    evPaise?: number;
    reasoning?: string;
    rationale?: string;
    steps?: Array<{
      stepOrder?: number;
      stepNo?: number;
      channel: string;
      action: string;
      scheduledAt: number;
      scheduledIso?: string;
      status: string;
      executedAt?: number | null;
      exitCriteria?: string;
    }>;
  } | null;
  interventionPlan?: {
    playbook: string;
    evPaise: number;
    expectedValuePaise?: number;
    rationale?: string;
    reasoning?: string;
    skipped?: boolean;
    skipReason?: string | null;
    steps?: Array<{
      stepNo?: number;
      stepOrder?: number;
      channel: string;
      action: string;
      scheduledAt: number;
      scheduledIso?: string;
      status: string;
      exitCriteria?: string;
    }>;
  } | null;
  gateDecisions?: Array<{
    id: string;
    planStepId?: string | null;
    allowed: boolean;
    reasonCode?: string;
    reasonCodes?: string[];
    passportSignature?: string | null;
    evaluatedAt?: number;
    decidedAt?: number;
    decidedIso?: string;
    details?: string;
    stepOrder?: number;
    stepNo?: number;
    channel?: string;
    action?: string;
  }>;
  communications?: Array<{
    id: string;
    channel: string;
    action?: string;
    templateId?: string | null;
    payload?: string;
    payloadText?: string;
    sentAt: number;
    sentIso?: string;
    status?: string;
    deliveryStatus?: string;
    customerReplied?: boolean;
    replyText?: string | null;
  }>;
  auditTrail?: Array<{
    seq: number;
    id?: string;
    eventId?: string;
    action: string;
    actor: string;
    decision: string;
    reasonCodes?: string[] | string | null;
    timestamp?: number;
    ts?: number;
    prevHash: string;
    hash: string;
    inputsDigest?: string;
  }>;
  recovery?: any;
  recoveries?: Array<{
    id: string;
    amountPaise: number;
    recoveredAt: number;
    recoveredIso: string;
    channel: string;
    playbook: string;
    cohort: string;
    resolvedVia?: string;
    paymentRef?: string;
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
