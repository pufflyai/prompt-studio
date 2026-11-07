import type { StorageOwner } from "pstdio-sync";
import { applyOrderedNativeOperation, operationDependencies } from "pstdio-sync/records";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import { storage_ordered_owners as owners } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { applyOrderedNumberPolicy } from "./ordered-number-admission";
import { pendingOrderedOperations } from "./ordered-pending";
import { applyBoundedOrderedOperation } from "./ordered-policy";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { orderedOwnerJoinedCloud, readOrderedOwner } from "./ordered-stream-state";

/** Never-joined devices own their order. Joining Cloud permanently ends local settlement. */
export const settleLocalOrderedSaves = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  selected?: Awaited<ReturnType<OrderedJournal["pending"]>>,
) => {
  const row = await readOrderedOwner(tx, owner);
  if (await orderedOwnerJoinedCloud(tx, owner, row)) return [];
  const epoch = row.epoch ?? `local:${crypto.randomUUID()}`;
  if (!row.epoch) await tx.update(owners).set({ epoch }).where(orderedOwnerWhere(owners, owner));
  const changed = new Set<string>();
  for await (const { operation, requestFingerprint } of selected ?? pendingOrderedOperations(journal)) {
    const decisions = new Map();
    const dependencies = [];
    for (const [operationId, identity] of operationDependencies(operation)) {
      const decision = await journal.knownDependency(operationId);
      if (!decision || decision.fingerprint !== identity) continue;
      decisions.set(operationId, decision);
      dependencies.push({ operationId, fingerprint: identity, epoch: decision.epoch });
    }
    // A foreign editor source can carry an unknown Cloud parent; local authority cannot decide it.
    if (dependencies.length !== operationDependencies(operation).size) continue;
    const ids = operation.edits.map((edit) => edit.recordId);
    const before = await journal.canonical(ids);
    if (isOrderedNativeRequest(requestFingerprint)) {
      const result = await applyOrderedNativeOperation(before, operation, epoch, decisions);
      await journal.saveCanonical(result.records);
      await journal.completeNative(operation, result.state);
    } else {
      const admission = { epoch, operation, dependencies };
      await journal.admit(admission);
      const result = await applyOrderedNumberPolicy(
        tx,
        owner,
        operation,
        epoch,
        await applyBoundedOrderedOperation(before, operation, epoch, undefined, decisions),
        false,
      );
      await journal.saveCanonical(result.records);
      await journal.recordDecision(result.decision, await fingerprint(admission as unknown as Json));
      await journal.dropSettledEnvelope(operation.operationId);
      for (const record of result.records) changed.add(record.recordId);
    }
    for (const id of ids) changed.add(id);
  }
  return [...changed];
};
