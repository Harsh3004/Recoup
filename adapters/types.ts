/**
 * Communication & Gateway Mock Adapters Types
 */

export interface AdapterMessageInput {
  riskItemId: string;
  planStepId: string;
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  language: "EN" | "HI" | "HINGLISH";
  segment: "B2C" | "SMB" | "ENTERPRISE";
  exposurePaise: number;
  rootCause: string;
  playbook: string;
  stepNo: number;
  action: string;
  scheduledAt: number;
  metadata?: Record<string, unknown>;
}

export interface AdapterMessageOutput {
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "VOICE" | "GATEWAY" | "AGENT";
  templateId?: string;
  dltEntityId?: string;
  subject?: string;
  payload: string; // Full formatted payload / transcript / JSON
  metadata: Record<string, unknown>;
}

export interface GatewayExecutionResult {
  success: boolean;
  gatewayRef: string;
  declineCode?: string;
  message: string;
}
