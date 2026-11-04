import type { StorageOwner } from "pstdio-sync";
import type {
  createOrderedReceiptIndex,
  OrderedDecision,
  OrderedIndexReference,
  OrderedOperation,
  OrderedRecord,
} from "pstdio-sync/records";
import { applyOrderedNativeOperation } from "pstdio-sync/records";
import { encodeOrderedEntry, type OrderedReceipt } from "pstdio-sync/relay";
import { type Asset, fingerprint, type Json } from "pstdio-sync-contracts";
import { storage_ordered_records as canonical } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { OrderedNumberLimitError } from "./ordered-number-limits";
import { OrderedNumberRangeError } from "./ordered-number-repair";
import { createStagedNumberRepair } from "./ordered-number-stage";
import { pendingOrderedOperations } from "./ordered-pending";
import { applyBoundedOrderedOperation } from "./ordered-policy";
import { orderedBody } from "./ordered-projection";
import { operationDependencies } from "./ordered-rebase";
import { decodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { orderedCursor, readOrderedOwner } from "./ordered-stream-state";

const stagedDependencies = async (
  journal: OrderedJournal,
  operation: Parameters<typeof operationDependencies>[0],
  epoch: string,
  decisions: Map<string, OrderedDecision>,
  resolve?: (id: string, fingerprint: string, epoch: string) => Promise<OrderedDecision | undefined>,
) => {
  const dependencies = [];
  const resolved = new Map<string, OrderedDecision>();
  for (const [id, identity] of operationDependencies(operation)) {
    const decision =
      decisions.get(id) ??
      (await journal.knownDependency(id)) ??
      (resolve ? await resolve(id, identity, epoch) : await journal.cachedDecision(id, epoch));
    if (!decision) return;
    if (decision.fingerprint !== identity) throw new Error("Founding requires an exact dependency receipt");
    dependencies.push({ operationId: id, fingerprint: identity, epoch: decision.epoch });
    resolved.set(id, decision);
  }
  return { dependencies, resolved };
};
export const dirtyOrderedReceipts = async (journal: OrderedJournal) => {
  const collected: OrderedReceipt[] = [];
  let after: { epoch: string; operationId: string } | undefined;
  while (true) {
    const page = await journal.unindexed({ after });
    if (!page.length) return collected;
    collected.push(...page);
    after = page.at(-1)!.decision;
  }
};
const repairStagedAdmission = async (
  numbers: ReturnType<typeof createStagedNumberRepair>,
  operation: OrderedOperation,
  epoch: string,
  result: Awaited<ReturnType<typeof applyBoundedOrderedOperation>>,
  known: boolean,
) => {
  if (result.decision.state !== "accepted" || known) return result;
  try {
    return {
      ...result,
      records: await numbers.apply(
        result.records,
        operation,
        JSON.stringify(["canonical", epoch, operation.operationId]),
      ),
    };
  } catch (error) {
    if (!(error instanceof OrderedNumberRangeError || error instanceof OrderedNumberLimitError)) throw error;
    return { decision: { ...result.decision, state: "refused" as const }, records: [] };
  }
};

/** Snapshot records and its newly included decisions are captured under one owner lock, before uploads. */
export const stageOrderedCheckpoint = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  epoch: string,
  found: boolean,
  resolve?: (id: string, fingerprint: string, epoch: string) => Promise<OrderedDecision | undefined>,
) => {
  const row = await readOrderedOwner(tx, owner);
  const rows = await tx.select().from(canonical).where(orderedOwnerWhere(canonical, owner));
  const records = new Map(rows.map((row) => [row.record_id, decodeOrderedJson<OrderedRecord>(row.state)]));
  const numbers = createStagedNumberRepair(owner, records);
  const receipts = await dirtyOrderedReceipts(journal);
  const decisions = new Map<string, OrderedDecision>();
  const native: { operation: OrderedOperation; state: "accepted" | "refused" }[] = [];
  let outbox = 0;
  for await (const { operation, sequence, requestFingerprint } of pendingOrderedOperations(journal)) {
    if (!found)
      return {
        native,
        epoch,
        found,
        records: [],
        assets: new Map<string, Asset>(),
        outbox: sequence,
        receipts,
        base: orderedCursor(row),
      };
    const ready = await stagedDependencies(journal, operation, epoch, decisions, resolve);
    if (!ready) continue;
    const { dependencies, resolved } = ready;
    if (isOrderedNativeRequest(requestFingerprint)) {
      const result = await applyOrderedNativeOperation(records, operation, epoch, resolved);
      for (const record of result.records) records.set(record.recordId, record);
      native.push({ operation, state: result.state });
      outbox = sequence;
      continue;
    }
    const admission = { epoch, operation, dependencies };
    const applied = await applyBoundedOrderedOperation(records, operation, epoch, undefined, resolved);
    const result = await repairStagedAdmission(
      numbers,
      operation,
      epoch,
      applied,
      decisions.has(operation.operationId),
    );
    for (const record of result.records) records.set(record.recordId, record);
    decisions.set(operation.operationId, result.decision);
    receipts.push({
      decision: result.decision,
      admissionFingerprint: await fingerprint(admission as unknown as Json),
    });
    outbox = sequence;
  }
  const assets = new Map<string, Asset>();
  for (const record of records.values())
    if (orderedBody(record).asset)
      assets.set(encodeOrderedEntry({ type: "record", record }).recordId, orderedBody(record).asset!);
  return {
    native,
    epoch,
    found,
    records: [...records.values()].map((record) => encodeOrderedEntry({ type: "record", record })),
    assets,
    outbox,
    receipts,
    base: orderedCursor(row),
  };
};

export const indexOrderedCheckpoint = async (
  stage: Awaited<ReturnType<typeof stageOrderedCheckpoint>>,
  index: ReturnType<typeof createOrderedReceiptIndex>,
  previous: OrderedIndexReference | null,
) => {
  let root = previous;
  for (let offset = 0; offset < stage.receipts.length; offset += 100)
    root = await index.append(root, stage.receipts.slice(offset, offset + 100));
  return {
    ...stage,
    root,
    receiptRoot: root,
    records: [encodeOrderedEntry({ type: "meta", epoch: stage.epoch, receiptRoot: root }), ...stage.records],
    blobIds: root ? [root.blobId] : [],
  };
};
