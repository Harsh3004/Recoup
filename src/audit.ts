import { createHash } from "node:crypto";
import type { Database } from "bun:sqlite";

const GENESIS_PREV = "0".repeat(64);

export type AuditActor = "AGENT" | "HUMAN" | "SYSTEM";

export type AuditInput = {
  actor: AuditActor;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  inputs?: unknown;
  decision?: string | null;
  reasonCodes?: string[] | string | null;
  policyVersion?: string | null;
  modelVersion?: string | null;
  ts: number;
};

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function digestInputs(inputs: unknown): string {
  return sha256Hex(canonical(inputs ?? null));
}

export function computeEventHash(prevHash: string, payload: Record<string, unknown>): string {
  return sha256Hex(`${prevHash}|${canonical(payload)}`);
}

function nextSeq(db: Database): number {
  const row = db.query("SELECT COALESCE(MAX(seq), 0) AS m FROM audit_events").get() as { m: number };
  return row.m + 1;
}

function lastHash(db: Database): string {
  const row = db.query("SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1").get() as
    | { hash: string }
    | undefined;
  return row?.hash ?? GENESIS_PREV;
}

/**
 * Append-only audit write. Every state change and gate decision must go through here.
 * Hash-chain verification (verify_chain) is completed in Step 7; the chain is live from seed.
 */
export function appendAudit(db: Database, input: AuditInput): { seq: number; id: string; hash: string } {
  const seq = nextSeq(db);
  const id = `aud_${seq.toString().padStart(8, "0")}`;
  const prevHash = lastHash(db);
  const reason =
    input.reasonCodes == null
      ? null
      : Array.isArray(input.reasonCodes)
        ? input.reasonCodes.join(",")
        : input.reasonCodes;
  const inputsDigest = digestInputs(input.inputs ?? null);
  const payload = {
    seq,
    id,
    actor: input.actor,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    inputs_digest: inputsDigest,
    decision: input.decision ?? null,
    reason_codes: reason,
    policy_version: input.policyVersion ?? null,
    model_version: input.modelVersion ?? null,
    ts: input.ts,
  };
  const hash = computeEventHash(prevHash, payload);
  db.query(
    `INSERT INTO audit_events (
       seq, id, prev_hash, hash, actor, action, entity_type, entity_id,
       inputs_digest, decision, reason_codes, policy_version, model_version, ts
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    seq,
    id,
    prevHash,
    hash,
    payload.actor,
    payload.action,
    payload.entity_type,
    payload.entity_id,
    payload.inputs_digest,
    payload.decision,
    payload.reason_codes,
    payload.policy_version,
    payload.model_version,
    payload.ts,
  );
  return { seq, id, hash };
}
