import { jsonSchema } from "pstdio-sync-contracts";
import type { OrderedAdmission, OrderedDecision, OrderedRecord } from "../records/ordered-operation";
import { verifyOrderedAdmission, verifyOrderedRecord } from "../records/ordered-operation-wire";

export type OrderedReceipt = { decision: OrderedDecision; admissionFingerprint: string };
export type OrderedStreamEntry =
  | { type: "record"; record: OrderedRecord }
  | { type: "admission"; admission: OrderedAdmission }
  | { type: "meta"; epoch: string; receipts: OrderedReceipt[] };
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const fields = (input: unknown, allowed: string[]) => {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new Error("Invalid ordered entry fields");
};
const text = (value: unknown) => {
  if (typeof value !== "string" || !value) throw new Error("Invalid ordered identity");
};
const digest = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error("Invalid ordered fingerprint");
};
export const orderedEntryId = (entry: OrderedStreamEntry) => {
  if (entry.type === "record") return JSON.stringify(["record", entry.record.recordId]);
  if (entry.type === "admission")
    return JSON.stringify(["admission", entry.admission.epoch, entry.admission.operation.operationId]);
  return JSON.stringify(["meta"]);
};
export const encodeOrderedEntry = (entry: OrderedStreamEntry) => ({
  recordId: orderedEntryId(entry),
  bytes: encoder.encode(JSON.stringify(entry)),
});

const validateReceipts = (receipts: unknown[]) => {
  for (const item of receipts) {
    const receipt = item as unknown as OrderedReceipt;
    fields(receipt, ["decision", "admissionFingerprint"]);
    fields(receipt.decision, ["epoch", "operationId", "fingerprint", "state"]);
    text(receipt?.decision?.epoch);
    text(receipt?.decision?.operationId);
    digest(receipt?.decision?.fingerprint);
    digest(receipt?.admissionFingerprint);
    if (!["accepted", "refused"].includes(receipt.decision.state)) throw new Error("Invalid ordered decision");
  }
};

/** Client payload validation is independent of the blind relay. No record is applied until its whole frame opens. */
export const decodeOrderedEntry = async (bytes: Uint8Array) => {
  const input = jsonSchema.parse(JSON.parse(decoder.decode(bytes)));
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid ordered entry");
  if (input.type === "record") {
    fields(input, ["type", "record"]);
    verifyOrderedRecord(input.record);
  } else if (input.type === "admission") {
    fields(input, ["type", "admission"]);
    input.admission = (await verifyOrderedAdmission(input.admission)) as unknown as typeof input.admission;
  } else if (input.type === "meta") {
    fields(input, ["type", "epoch", "receipts"]);
    text(input.epoch);
    if (!Array.isArray(input.receipts)) throw new Error("Invalid ordered receipts");
    validateReceipts(input.receipts);
  } else throw new Error("Unknown ordered entry");
  return input as unknown as OrderedStreamEntry;
};
