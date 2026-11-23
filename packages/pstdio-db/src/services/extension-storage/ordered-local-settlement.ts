import type { StorageOwner } from "pstdio-sync";
import { applyOrderedNativeOperation, type OrderedOperation, operationDependencies } from "pstdio-sync/records";
import { owners } from "../../db/schemas.pg";
import type { createOrderedCanonicalBatch } from "./ordered-canonical-batch";
import type { OrderedJournal } from "./ordered-journal";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { applyOrderedNumberPolicy } from "./ordered-number-admission";
import { pendingOrderedOperations } from "./ordered-pending";
import { applyBoundedOrderedOperation } from "./ordered-policy";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { orderedOwnerJoinedCloud, readOrderedOwner } from "./ordered-stream-state";

type CanonicalBatch = ReturnType<typeof createOrderedCanonicalBatch>;

const settlementJournal = async (
  journal: OrderedJournal,
  batch: CanonicalBatch | undefined,
  operation: OrderedOperation,
  native: boolean,
) => {
  if (!batch) return journal;
  if (!native && !operation.edits.some((edit) => edit.texts?.length)) return batch.journal;
  await batch.flush();
  return journal;
};

/** Never-joined devices own their order. Joining Cloud permanently ends local settlement. */
export const settleLocalOrderedSaves = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  selected?: Awaited<ReturnType<OrderedJournal["pending"]>>,
  canonical?: CanonicalBatch,
) => {
  const row = await readOrderedOwner(tx, owner);
  if (orderedOwnerJoinedCloud(row)) return;
  const epoch = row.epoch ?? `local:${crypto.randomUUID()}`;
  if (!row.epoch) await tx.update(owners).set({ epoch }).where(orderedOwnerWhere(owners, owner));
  const changed = new Set<string>();
  let pending = false;
  for await (const { operation, requestFingerprint } of selected ?? pendingOrderedOperations(journal)) {
    const decisions = new Map();
    const dependencies = [];
    const required = operationDependencies(operation);
    for (const [operationId, identity] of required) {
      const decision = await journal.knownDependency(operationId);
      if (!decision || decision.fingerprint !== identity) continue;
      decisions.set(operationId, decision);
      dependencies.push({ operationId, fingerprint: identity, epoch: decision.epoch });
    }
    // A foreign editor source can carry an unknown Cloud parent; local authority cannot decide it.
    if (dependencies.length !== required.size) {
      pending = true;
      continue;
    }
    const ids = operation.edits.map((edit) => edit.recordId);
    const native = isOrderedNativeRequest(requestFingerprint);
    const writes = await settlementJournal(journal, canonical, operation, native);
    const before = await writes.canonical(ids);
    if (native) {
      const result = await applyOrderedNativeOperation(before, operation, epoch, decisions);
      await writes.saveCanonical(result.records);
      await journal.completeNative(operation, result.state);
    } else {
      const admission = { epoch, operation, dependencies };
      const identity = await journal.admit(admission);
      const result = await applyOrderedNumberPolicy(
        tx,
        owner,
        operation,
        epoch,
        await applyBoundedOrderedOperation(before, operation, epoch, undefined, decisions),
        false,
      );
      await writes.saveCanonical(result.records);
      await journal.recordDecision(result.decision, identity);
      for (const record of result.records) changed.add(record.recordId);
    }
    for (const id of ids) changed.add(id);
  }
  return { changed, pending };
};
