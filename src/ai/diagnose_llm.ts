import { callStructuredLlm } from "./llm_client";

export interface LlmDiagnosisInput {
  riskItemId: string;
  invoiceNumber: string;
  customerName: string;
  segment: string;
  exposurePaise: number;
  ageingBucket: string;
  poNumber: string | null;
  disputeOpen: boolean;
  disputeType: string | null;
  disputeNotes: string | null;
  emailThread: string | null;
}

export interface LlmDiagnosisOutput {
  rootCause: string;
  confidenceBps: number;
  evidenceSpans: string[];
  recommendedPlaybook: string;
  rationale: string;
  model: string;
  cached: boolean;
  fallbackUsed?: boolean;
  llmUsed: boolean;
  llmSkippedReason?: string | null;
  latencyMs?: number | null;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

const SYSTEM_PROMPT = `You are Recoup's Autonomous B2B Accounts Receivable NLU Agent.
Your task is to analyze unstructured correspondence (email threads, AP dispute notes, PO numbers, ageing) between a merchant and a buyer AP desk to determine the exact root cause of non-payment.

Available Root Causes:
1. PO_GRN_MISMATCH: Missing Goods Receipt Note (GRN), delivery challan missing, stores confirmation pending.
2. INVOICE_NOT_RECEIVED: AP inbox never received the PDF, requested resend to AP contact.
3. APPROVAL_STUCK: Invoice verified by AP but awaiting managerial / budget owner sign-off in internal ERP queue.
4. LINE_ITEM_DISPUTE: Discrepancy in unit rates, delivered quantities, discount terms, or awaiting credit note.
5. CASH_CRUNCH: Buyer explicitly acknowledges liability but requests installment schedule, payment holiday, or extension due to liquidity.
6. INVOICE_UNPAID: General overdue invoice with no specific dispute raised.

Output MUST strictly be valid JSON matching this schema:
{
  "root_cause": string,
  "confidence_bps": number (between 5000 and 9900),
  "evidence_spans": string[],
  "recommended_playbook": string ("PROMISE_TO_PAY" | "PARTIAL_PAYMENT" | "HUMAN_ESCALATION" | "DUNNING_LADDER"),
  "rationale": string
}`;

export async function diagnoseUnstructuredInvoiceLlm(
  input: LlmDiagnosisInput,
): Promise<LlmDiagnosisOutput> {
  const userPrompt = `Analyze B2B Invoice Case:
- Customer: ${input.customerName} (${input.segment})
- Invoice: ${input.invoiceNumber}
- Outstanding Amount: ₹${(input.exposurePaise / 100).toFixed(2)}
- Ageing Bucket: ${input.ageingBucket}
- PO Number: ${input.poNumber ?? "N/A"}
- Dispute Open: ${input.disputeOpen ? "YES" : "NO"}
- Dispute Notes: ${input.disputeNotes ?? "None"}
- AP Email Thread:
"""
${input.emailThread ?? "No email correspondence recorded."}
"""`;

  const fallbackGenerator = () => {
    const text = `${input.emailThread ?? ""} ${input.disputeNotes ?? ""}`;
    let cause = "INVOICE_UNPAID";
    let playbook = "PROMISE_TO_PAY";
    const evidence: string[] = [];

    if (/GRN|delivery challan|stores confirm/i.test(text)) {
      cause = "PO_GRN_MISMATCH";
      playbook = "HUMAN_ESCALATION";
      evidence.push(`Email thread cites missing Goods Receipt Note (GRN) against PO ${input.poNumber ?? "N/A"}`);
      evidence.push("AP team requested delivery challan confirmation from stores before payment release");
    } else if (/no invoice in the AP inbox|re-send to ap@|never received|Invoice \w+\?/i.test(text)) {
      cause = "INVOICE_NOT_RECEIVED";
      playbook = "DUNNING_LADDER";
      evidence.push("Client accounts payable inbox did not receive initial PDF invoice transmission");
      evidence.push("Action required: Re-send digital invoice copy to AP contact with finance CC");
    } else if (/budget owner|stuck in queue|approval/i.test(text)) {
      cause = "APPROVAL_STUCK";
      playbook = "PROMISE_TO_PAY";
      evidence.push("Invoice verified by AP but awaiting internal managerial / budget owner sign-off");
      evidence.push("Not disputed — payment queue delayed due to approver queue latency");
    } else if (/Discrepancy|quantity|rate|line item|credit note/i.test(text)) {
      cause = "LINE_ITEM_DISPUTE";
      playbook = "HUMAN_ESCALATION";
      evidence.push("Line-item discrepancy raised by customer on rates / delivered quantities");
      evidence.push("Resolution path: Issue credit note or reconciliation statement for disputed delta");
    } else if (/cash flow|liquidity|cash crunch|extension/i.test(text)) {
      cause = "CASH_CRUNCH";
      playbook = "PARTIAL_PAYMENT";
      evidence.push("Customer acknowledged liability but requested instalment schedule due to liquidity constraints");
      evidence.push("Recommendation: Partial payment agreement / promise-to-pay capture");
    } else if (input.disputeType) {
      cause = input.disputeType;
      playbook = "HUMAN_ESCALATION";
      evidence.push(`Customer filed dispute code: ${input.disputeType}`);
    } else {
      cause = input.ageingBucket === "90_PLUS" ? "CASH_CRUNCH" : "INVOICE_UNPAID";
      playbook = input.ageingBucket === "90_PLUS" ? "PARTIAL_PAYMENT" : "PROMISE_TO_PAY";
      evidence.push(`Invoice overdue in ${input.ageingBucket} bucket with standard terms`);
    }

    return {
      root_cause: cause,
      confidence_bps: 9400,
      evidence_spans: evidence,
      recommended_playbook: playbook,
      rationale: `NLU classification identified ${cause} from AP correspondence context.`,
    };
  };

  const resp = await callStructuredLlm<{
    root_cause: string;
    confidence_bps: number;
    evidence_spans: string[];
    recommended_playbook: string;
    rationale: string;
  }>(
    {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.1,
    },
    fallbackGenerator,
  );

  return {
    rootCause: resp.parsed.root_cause,
    confidenceBps: resp.parsed.confidence_bps,
    evidenceSpans: resp.parsed.evidence_spans ?? [],
    recommendedPlaybook: resp.parsed.recommended_playbook,
    rationale: resp.parsed.rationale,
    model: resp.model,
    cached: resp.cached,
    fallbackUsed: resp.fallbackUsed,
    llmUsed: resp.llmUsed,
    llmSkippedReason: resp.llmSkippedReason ?? null,
    latencyMs: resp.latencyMs ?? null,
    tokenUsage: resp.tokenUsage ?? null,
  };
}
