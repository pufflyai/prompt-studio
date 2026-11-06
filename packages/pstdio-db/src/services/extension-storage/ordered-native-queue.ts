import type { StorageOwner } from "pstdio-sync";
import {
  type OrderedOperation,
  type OrderedRecord,
  orderedNativeDependenciesReady,
  projectOrderedOperation,
  validateOrderedNativeOperation,
  verifyOrderedOperation,
} from "pstdio-sync/records";
import { assertStorageLimits } from "pstdio-sync-contracts";
import type { OrderedJournal } from "./ordered-journal";
import { orderedNativeRequestPrefix } from "./ordered-native-identity";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { orderedProjection } from "./ordered-projection";
import { knownDependencies, rebaseOrderedProjection } from "./ordered-rebase";
import type { OrderedTransaction } from "./ordered-sql";

/** Local native intent is durable until ordering, while its Y structs provide retry idempotence. */
export const queueOrderedNativeOperation = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  input: OrderedOperation,
  requestIdentity?: string,
  current?: ReadonlyMap<string, OrderedRecord>,
) => {
  const operation = await verifyOrderedOperation(input);
  validateOrderedNativeOperation(operation);
  const views =
    current ??
    (
      await rebaseOrderedProjection(
        journal,
        tx,
        owner,
        operation.edits.map((edit) => edit.recordId),
      )
    ).views;
  const decisions = await knownDependencies(journal, operation);
  // Inspect the actual candidate's size before queueing even when its foreign receipt has
  // not arrived. This temporary copy cannot settle or publish; immutable causality stays intact.
  const inspected = orderedNativeDependenciesReady(views, operation, decisions)
    ? operation
    : {
        ...operation,
        edits: operation.edits.map((edit) => ({
          ...edit,
          texts: edit.texts!.map((text) => ({ ...text, dependencies: [] })),
        })),
      };
  const projected = projectOrderedOperation(views, inspected, decisions);
  assertStorageLimits(await Promise.all(projected.map(orderedProjection)));
  // An incoming full editor source already contains private work even while its foreign parent is unknown here.
  await rememberOrderedTextGeneration(tx, owner, operation);
  return journal.queue(operation, `${orderedNativeRequestPrefix}${requestIdentity ?? operation.fingerprint}`);
};
