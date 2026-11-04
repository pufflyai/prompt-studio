import { canonicalJson, fingerprint, fingerprintSchema, type Json } from "pstdio-sync-contracts";
import type { OrderedReceipt } from "../relay/ordered-stream-entry";
import { type OrderedIndexReference, readOrderedIndexReference } from "./ordered-receipt-index-blobs";

export type ReceiptIndexValue =
  | { type: "identity"; fingerprint: string; epoch: string }
  | { type: "receipt"; receipt: OrderedReceipt };
export type ReceiptIndexEntry = { key: string; value: ReceiptIndexValue };
export type ReceiptIndexLeaf = {
  version: 1;
  format: "ordered-receipts";
  type: "leaf";
  prefix: string;
  entries: ReceiptIndexEntry[];
};
export type ReceiptIndexBranch = {
  version: 1;
  format: "ordered-receipts";
  type: "branch";
  prefix: string;
  children: Record<string, OrderedIndexReference>;
};
export type ReceiptIndexNode = ReceiptIndexLeaf | ReceiptIndexBranch;
export const receiptLeafEntries = 32;
const fields = (input: unknown, allowed: string[]) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid receipt index object");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== allowed.length || allowed.some((key) => !Object.hasOwn(value, key)))
    throw new Error("Invalid receipt index fields");
  return value;
};
export const receiptIdentity = (input: unknown) => {
  if (typeof input !== "string" || !input) throw new Error("Invalid receipt identity");
};
export const validateOrderedReceipt = (input: unknown) => {
  const receipt = fields(input, ["decision", "admissionFingerprint"]);
  const decision = fields(receipt.decision, ["epoch", "operationId", "fingerprint", "state"]);
  receiptIdentity(decision.epoch);
  receiptIdentity(decision.operationId);
  fingerprintSchema.parse(decision.fingerprint);
  fingerprintSchema.parse(receipt.admissionFingerprint);
  if (decision.state !== "accepted" && decision.state !== "refused") throw new Error("Invalid receipt decision");
  return input as OrderedReceipt;
};
export const receiptIndexKey = (kind: "identity" | "receipt", operationId: string, epoch?: string) =>
  fingerprint(["ordered-receipts", kind, operationId, epoch ?? null]);
export const sameReceiptIndexValue = (first: ReceiptIndexValue, second: ReceiptIndexValue) =>
  canonicalJson(first as unknown as Json) === canonicalJson(second as unknown as Json);
export const assertReceiptIndexBinding = (
  previousIdentity: ReceiptIndexValue | undefined,
  identity: ReceiptIndexValue,
  previousReceipt: ReceiptIndexValue | undefined,
  receipt: ReceiptIndexValue,
) => {
  if (previousIdentity && !sameReceiptIndexValue(previousIdentity, identity))
    throw new Error("Operation identity reused with changed payload");
  if (previousReceipt && !previousIdentity) throw new Error("Receipt is missing its global identity");
  if (previousReceipt && !sameReceiptIndexValue(previousReceipt, receipt))
    throw new Error("An ordered receipt is immutable");
};
const validateValue = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid receipt index value");
  if ((input as ReceiptIndexValue).type === "identity") {
    const value = fields(input, ["type", "fingerprint", "epoch"]);
    fingerprintSchema.parse(value.fingerprint);
    receiptIdentity(value.epoch);
  } else {
    const value = fields(input, ["type", "receipt"]);
    if (value.type !== "receipt") throw new Error("Unknown receipt index value");
    validateOrderedReceipt(value.receipt);
  }
};
const validateLeaf = (node: ReceiptIndexLeaf, prefix: string) => {
  fields(node, ["version", "format", "type", "prefix", "entries"]);
  if (!Array.isArray(node.entries) || !node.entries.length || node.entries.length > receiptLeafEntries)
    throw new Error("Invalid receipt leaf extent");
  let previous = "";
  for (const input of node.entries) {
    const entry = fields(input, ["key", "value"]);
    const key = fingerprintSchema.parse(entry.key);
    if (key <= previous || !key.startsWith(prefix)) throw new Error("Invalid receipt leaf ordering or route");
    validateValue(entry.value);
    previous = key;
  }
};
const validateBranch = (node: ReceiptIndexBranch, prefix: string) => {
  fields(node, ["version", "format", "type", "prefix", "children"]);
  if (
    node.type !== "branch" ||
    prefix.length >= 64 ||
    !node.children ||
    typeof node.children !== "object" ||
    Array.isArray(node.children)
  )
    throw new Error("Invalid receipt index branch");
  const children = Object.entries(node.children);
  if (!children.length || children.length > 16) throw new Error("Invalid receipt branch extent");
  for (const [key, reference] of children) {
    if (!/^[a-f0-9]$/.test(key)) throw new Error("Invalid receipt branch key");
    readOrderedIndexReference(reference);
  }
};
export const validateReceiptIndexNode = (input: unknown, prefix: string) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid receipt index node");
  const node = input as ReceiptIndexNode;
  if (node.version !== 1 || node.format !== "ordered-receipts" || node.prefix !== prefix || prefix.length > 64)
    throw new Error("Receipt index route or format mismatch");
  if (node.type === "leaf") validateLeaf(node, prefix);
  else validateBranch(node, prefix);
  return node;
};
export const validateReceiptPageAddresses = async (node: ReceiptIndexNode) => {
  if (node.type !== "leaf") return;
  for (const entry of node.entries) {
    if (entry.value.type !== "receipt") continue;
    const decision = entry.value.receipt.decision;
    if (entry.key !== (await receiptIndexKey("receipt", decision.operationId, decision.epoch)))
      throw new Error("Receipt does not match its index address");
  }
};
export const groupReceiptEntries = (entries: ReceiptIndexEntry[], depth: number) => {
  const groups = new Map<string, ReceiptIndexEntry[]>();
  for (const entry of entries) {
    const key = entry.key[depth]!;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return groups;
};
export const mergeReceiptEntries = (before: ReceiptIndexEntry[], entries: ReceiptIndexEntry[]) => {
  const merged = new Map(before.map((entry) => [entry.key, entry]));
  let changed = false;
  for (const entry of entries) {
    const previous = merged.get(entry.key);
    if (previous && sameReceiptIndexValue(previous.value, entry.value)) continue;
    merged.set(entry.key, entry);
    changed = true;
  }
  return { changed, entries: [...merged.values()].sort((a, b) => a.key.localeCompare(b.key)) };
};
