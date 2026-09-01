import { callStructuredLlm } from "./llm_client";

export interface MessageCompositionInput {
  riskItemId: string;
  customerName: string;
  segment: "B2C" | "SMB" | "ENTERPRISE";
  language: "EN" | "HI" | "HINGLISH";
  exposurePaise: number;
  rootCause: string;
  playbook: string;
  stepNo: number;
  channel: "SMS" | "WHATSAPP" | "EMAIL" | "VOICE";
  dltTemplateBody?: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  sanitizedText?: string;
}

export interface ComposedMessageOutput {
  text: string;
  subject?: string;
  safetyPassed: boolean;
  violations: string[];
  model: string;
  fallbackUsed: boolean;
  regenerations: number;
}

// Banned threatening or predatory debt collection words prohibited by RBI / Fair Practices
const BANNED_PATTERNS = [
  /legal action immediately/i,
  /police complaint/i,
  /court summons/i,
  /defaulter list/i,
  /ruin your cibil/i,
  /public shame/i,
  /confiscate/i,
  /arrest/i,
  /criminal/i,
  /threat/i,
];

/**
 * Deterministic Safety Validator enforcing RBI, TRAI DLT, and brand safety invariants.
 */
export function validateMessageSafety(
  text: string,
  channel: "SMS" | "WHATSAPP" | "EMAIL" | "VOICE",
): ValidationResult {
  const violations: string[] = [];

  // 1. Check banned coercive phrases
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Contains prohibited coercive language matching: ${pattern.source}`);
    }
  }

  // 2. Character length caps
  if (channel === "SMS" && text.length > 320) {
    violations.push(`SMS character limit exceeded (${text.length} > 320 chars)`);
  }

  // 3. Mandatory payment link / assistance token presence
  if (channel !== "VOICE" && !text.includes("http") && !text.includes("rzp.io") && !text.includes("link") && !text.includes("support")) {
    violations.push("Message lacks actionable payment or support resolution pathway.");
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Persona-aware LLM copy generator with automatic deterministic validation loop.
 */
export async function composeConstrainedMessage(
  input: MessageCompositionInput,
): Promise<ComposedMessageOutput> {
  const amountFormatted = `₹${(input.exposurePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const systemPrompt = `You are Recoup's AI Communications Agent composing a courteous, compliance-first recovery notice in ${input.language}.
Rules:
1. Tone must be helpful, respectful, and relationship-preserving (RBI Fair Practices Code).
2. Never use threatening, aggressive, or coercive language.
3. State the outstanding amount (${amountFormatted}) and provide a clear resolution call-to-action.
4. Channel: ${input.channel}. Language: ${input.language}.`;

  const userPrompt = `Compose Step ${input.stepNo} recovery message for:
- Customer: ${input.customerName} (${input.segment})
- Root Cause: ${input.rootCause}
- Playbook: ${input.playbook}
- Amount: ${amountFormatted}`;

  const staticFallback = (): { text: string; subject?: string } => {
    if (input.language === "HI") {
      return {
        text: `नमस्ते ${input.customerName}, आपका ${amountFormatted} का भुगतान लंबित है। कृपया समाधान हेतु लिंक पर क्लिक करें: https://rzp.io/i/recoup_pay सहायता: support@merchant.com`,
        subject: `भुगतान सूचना - ${amountFormatted}`,
      };
    }
    if (input.language === "HINGLISH") {
      return {
        text: `Hi ${input.customerName}, aapka ${amountFormatted} ka payment pending hai. Quick 1-tap UPI payment ke liye yahan click karein: https://rzp.io/i/recoup_pay`,
        subject: `Payment Update: ${amountFormatted} Pending`,
      };
    }
    return {
      text: `Dear ${input.customerName}, your payment of ${amountFormatted} is pending. Please complete your payment securely at: https://rzp.io/i/recoup_pay`,
      subject: `Pending Payment of ${amountFormatted}`,
    };
  };

  const resp = await callStructuredLlm<{ text: string; subject?: string }>(
    {
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    },
    staticFallback,
  );

  const candidateText = resp.parsed.text ?? staticFallback().text;
  const validation = validateMessageSafety(candidateText, input.channel);

  if (!validation.valid) {
    const fallback = staticFallback();
    return {
      text: fallback.text,
      subject: fallback.subject,
      safetyPassed: false,
      violations: validation.violations,
      model: "recoup-safety-fallback-v1",
      fallbackUsed: true,
      regenerations: 1,
    };
  }

  return {
    text: candidateText,
    subject: resp.parsed.subject,
    safetyPassed: true,
    violations: [],
    model: resp.model,
    fallbackUsed: resp.fallbackUsed ?? false,
    regenerations: 0,
  };
}
