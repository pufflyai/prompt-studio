import { type Json, jsonSchema } from "pstdio-sync-contracts";
import type { SyncSpace } from "../encryption";
import type { OrderedReceipt } from "../relay/ordered-stream-entry";
import {
  createEncryptedManifestNodes,
  type OrderedIndexBlobs,
  type OrderedIndexReference,
  readOrderedIndexReference,
} from "./ordered-receipt-index-blobs";
import { createReceiptTreeMerger } from "./ordered-receipt-index-merge";
import {
  assertReceiptIndexBinding,
  type ReceiptIndexEntry,
  type ReceiptIndexNode,
  type ReceiptIndexValue,
  receiptIdentity,
  receiptIndexKey,
  validateOrderedReceipt,
  validateReceiptIndexNode,
  validateReceiptPageAddresses,
} from "./ordered-receipt-index-pages";
import { createReceiptTreeWriter } from "./ordered-receipt-index-tree";

export type { OrderedIndexBlobs, OrderedIndexReference } from "./ordered-receipt-index-blobs";

const cacheEntries = 128;
/** Exact immutable decisions in a copy-on-write encrypted radix tree. Total retained history grows. */
export const createOrderedReceiptIndex = (input: { space: SyncSpace; blobs: OrderedIndexBlobs }) => {
  const nodes = createEncryptedManifestNodes(input.space, input.blobs);
  const cache = new Map<string, { node: ReceiptIndexNode; byteLength: number }>();
  const remember = (reference: OrderedIndexReference, node: ReceiptIndexNode) => {
    cache.set(reference.blobId, { node, byteLength: reference.byteLength });
    if (cache.size > cacheEntries) cache.delete(cache.keys().next().value!);
  };
  const read = async (input: OrderedIndexReference, prefix: string) => {
    const reference = readOrderedIndexReference(input);
    const cached = cache.get(reference.blobId);
    if (cached) {
      if (cached.byteLength !== reference.byteLength)
        throw new Error("Receipt page cached extent differs from authenticated extent");
      return validateReceiptIndexNode(cached.node, prefix);
    }
    const node = validateReceiptIndexNode(await nodes.read(reference), prefix);
    await validateReceiptPageAddresses(node);
    await nodes.retain(reference, node.type === "branch" ? Object.values(node.children) : []);
    remember(reference, node);
    return node;
  };
  const write = async (node: ReceiptIndexNode) => {
    const children = node.type === "branch" ? Object.values(node.children) : [];
    const reference = await nodes.write(node as unknown as Json, children);
    remember(reference, node);
    return reference;
  };
  const update = createReceiptTreeWriter({ read, write });
  const lookup = async (root: OrderedIndexReference | null, key: string, start = "") => {
    let reference = root;
    let prefix = start;
    while (reference) {
      const node = await read(reference, prefix);
      if (node.type === "leaf") return node.entries.find((entry) => entry.key === key)?.value;
      const digit = key[prefix.length]!;
      reference = node.children[digit] ?? null;
      prefix += digit;
    }
    return undefined;
  };
  const merge = createReceiptTreeMerger({ read, write, lookup, update });
  const getBinding = async (root: OrderedIndexReference | null, operationId: string) => {
    const reference = root && readOrderedIndexReference(root);
    receiptIdentity(operationId);
    const value = await lookup(reference, await receiptIndexKey("identity", operationId));
    if (value && value.type !== "identity") throw new Error("Receipt identity has the wrong index type");
    return value;
  };
  const getIdentity = async (root: OrderedIndexReference | null, operationId: string) =>
    (await getBinding(root, operationId))?.fingerprint;
  const getReceipt = async (root: OrderedIndexReference | null, epoch: string, operationId: string) => {
    const reference = root && readOrderedIndexReference(root);
    receiptIdentity(epoch);
    receiptIdentity(operationId);
    const value = await lookup(reference, await receiptIndexKey("receipt", operationId, epoch));
    if (
      value &&
      (value.type !== "receipt" ||
        value.receipt.decision.epoch !== epoch ||
        value.receipt.decision.operationId !== operationId)
    )
      throw new Error("Receipt does not match its index address");
    if (!value) return undefined;
    const binding = await getIdentity(reference, operationId);
    if (value.type !== "receipt" || binding !== value.receipt.decision.fingerprint)
      throw new Error("Receipt is missing its matching global identity");
    return structuredClone(value.receipt);
  };
  const getKnown = async (root: OrderedIndexReference | null, operationId: string) => {
    const reference = root && readOrderedIndexReference(root);
    const binding = await getBinding(reference, operationId);
    if (!binding) return undefined;
    const receipt = await getReceipt(reference, binding.epoch, operationId);
    if (!receipt) throw new Error("Retained identity is missing its representative receipt");
    return receipt;
  };
  const addReceipt = async (
    reference: OrderedIndexReference | null,
    entries: Map<string, ReceiptIndexEntry>,
    receipt: OrderedReceipt,
  ) => {
    const decision = receipt.decision;
    const identityKey = await receiptIndexKey("identity", decision.operationId);
    const receiptKey = await receiptIndexKey("receipt", decision.operationId, decision.epoch);
    const previousIdentity = entries.get(identityKey)?.value ?? (await lookup(reference, identityKey));
    if (previousIdentity && previousIdentity.type !== "identity")
      throw new Error("Receipt identity has the wrong index type");
    const identityValue: ReceiptIndexValue = {
      type: "identity",
      fingerprint: decision.fingerprint,
      epoch: previousIdentity?.epoch ?? decision.epoch,
    };
    const receiptValue: ReceiptIndexValue = { type: "receipt", receipt };
    const previousReceipt = entries.get(receiptKey)?.value ?? (await lookup(reference, receiptKey));
    assertReceiptIndexBinding(previousIdentity, identityValue, previousReceipt, receiptValue);
    // Preserve the first retained decision as a bounded historical address for pre-admission backups.
    if (previousIdentity) {
      const key = await receiptIndexKey("receipt", decision.operationId, previousIdentity.epoch);
      const known = entries.get(key)?.value ?? (await lookup(reference, key));
      if (!known || known.type !== "receipt" || known.receipt.decision.fingerprint !== previousIdentity.fingerprint)
        throw new Error("Retained identity is missing its representative receipt");
    }
    entries.set(identityKey, { key: identityKey, value: identityValue });
    entries.set(receiptKey, { key: receiptKey, value: receiptValue });
  };
  return {
    identity: getIdentity,
    receipt: getReceipt,
    known: getKnown,
    merge: (preferred: OrderedIndexReference | null, retained: OrderedIndexReference | null) =>
      merge(preferred && readOrderedIndexReference(preferred), retained && readOrderedIndexReference(retained)),
    async append(root: OrderedIndexReference | null, input: OrderedReceipt[]) {
      const reference = root && readOrderedIndexReference(root);
      const owned = JSON.parse(JSON.stringify(jsonSchema.parse(input))) as unknown[];
      if (!Array.isArray(owned)) throw new Error("Invalid receipt batch");
      const entries = new Map<string, ReceiptIndexEntry>();
      for (const input of owned) await addReceipt(reference, entries, validateOrderedReceipt(input));
      if (!entries.size) return reference;
      return update(reference, [...entries.values()]);
    },
  };
};
