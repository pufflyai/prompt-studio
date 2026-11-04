import { jsonSchema } from "pstdio-sync-contracts";
import { validateOrderedNativeOperation } from "../records/ordered-native-operation";
import type { OrderedAdmission, OrderedDecision, OrderedRecord } from "../records/ordered-operation";
import { verifyOrderedAdmission, verifyOrderedRecord } from "../records/ordered-operation-wire";
import { type OrderedIndexReference, readOrderedIndexReference } from "../records/ordered-receipt-index-blobs";

export type OrderedReceipt = { decision: OrderedDecision; admissionFingerprint: string };
export type OrderedStreamEntry =
  | { type: "record"; record: OrderedRecord }
  | { type: "admission"; admission: OrderedAdmission }
  | { type: "text"; admission: OrderedAdmission }
  | { type: "meta"; epoch: string; receiptRoot: OrderedIndexReference | null };
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
export const orderedEntryId = (entry: OrderedStreamEntry) => {
  if (entry.type === "record") return JSON.stringify(["record", entry.record.recordId]);
  if (entry.type === "text")
    return JSON.stringify([
      entry.type,
      entry.admission.epoch,
      entry.admission.operation.operationId,
      entry.admission.operation.fingerprint,
      entry.admission.dependencies,
    ]);
  if (entry.type === "admission")
    return JSON.stringify([entry.type, entry.admission.epoch, entry.admission.operation.operationId]);
  return JSON.stringify(["meta"]);
};
export const encodeOrderedEntry = (entry: OrderedStreamEntry) => ({
  recordId: orderedEntryId(entry),
  bytes: encoder.encode(JSON.stringify(entry)),
});

/** Client payload validation is independent of the blind relay. No record is applied until its whole frame opens. */
export const decodeOrderedEntry = async (bytes: Uint8Array) => {
  const input = jsonSchema.parse(JSON.parse(decoder.decode(bytes)));
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid ordered entry");
  if (input.type === "record") {
    fields(input, ["type", "record"]);
    await verifyOrderedRecord(input.record);
  } else if (input.type === "admission" || input.type === "text") {
    fields(input, ["type", "admission"]);
    const admission = await verifyOrderedAdmission(input.admission);
    input.admission = admission as unknown as typeof input.admission;
    if (input.type === "text") validateOrderedNativeOperation(admission.operation);
  } else if (input.type === "meta") {
    fields(input, ["type", "epoch", "receiptRoot"]);
    text(input.epoch);
    if (input.receiptRoot !== null) readOrderedIndexReference(input.receiptRoot);
  } else throw new Error("Unknown ordered entry");
  return input as unknown as OrderedStreamEntry;
};
