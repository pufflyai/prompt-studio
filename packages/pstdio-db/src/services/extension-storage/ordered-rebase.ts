import type { StorageOwner } from "pstdio-sync";
import {
  type OrderedAdmission,
  type OrderedDecision,
  type OrderedOperation,
  projectOrderedNativeOperation,
} from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { canProjectOrderedNumbers } from "./ordered-number-canonical";
import { projectWithOrderedNumberPolicy } from "./ordered-number-overlay";
import { markOrderedNumberProjectionCurrent, projectPendingNumberRecords } from "./ordered-number-projection";
import { pendingOrderedOperations } from "./ordered-pending";
import { projectBoundedOrderedOperation } from "./ordered-policy";
import { publishOrderedProjection, removeOrderedProjection } from "./ordered-projection";
import type { OrderedTransaction } from "./ordered-sql";

export { operationDependencies } from "pstdio-sync/records";

import { operationDependencies } from "pstdio-sync/records";

export const prepareOrderedAdmission = async (
  journal: OrderedJournal,
  operation: OrderedOperation,
  epoch: string,
  selected?: ReadonlyMap<string, OrderedDecision>,
) => {
  const dependencies: OrderedAdmission["dependencies"] = [];
  for (const [operationId, fingerprint] of operationDependencies(operation)) {
    const known = selected?.get(operationId) ?? (await journal.outcome(operationId));
    dependencies.push({ operationId, fingerprint, epoch: known?.epoch ?? epoch });
  }
  const admission = { epoch, operation, dependencies };
  await journal.admit(admission);
  return admission;
};

export const admissionDecisions = async (journal: OrderedJournal, admission: OrderedAdmission) => {
  const decisions = new Map<string, OrderedDecision>();
  const required = operationDependencies(admission.operation);
  if (required.size !== admission.dependencies.length) throw new Error("Ordered dependency admission is incomplete");
  for (const dependency of admission.dependencies) {
    if (required.get(dependency.operationId) !== dependency.fingerprint)
      throw new Error("Ordered dependency identity changed");
    const decision = await journal.cachedDecision(dependency.operationId, dependency.epoch);
    if (!decision) throw new Error("An ordered dependency requires its exact receipt");
    decisions.set(dependency.operationId, decision);
  }
  return decisions;
};

const pendingClosure = async (journal: OrderedJournal, changed: string[]) => {
  const ids = new Set(changed);
  let frontier = [...ids];
  while (frontier.length) {
    const next = new Set<string>();
    for await (const { operation } of pendingOrderedOperations(journal, frontier)) {
      for (const edit of operation.edits) {
        if (ids.has(edit.recordId)) continue;
        ids.add(edit.recordId);
        next.add(edit.recordId);
      }
    }
    frontier = [...next];
  }
  return [...ids];
};

export const knownDependencies = async (journal: OrderedJournal, operation: OrderedOperation) => {
  const decisions = new Map<string, OrderedDecision>();
  for (const id of operationDependencies(operation).keys()) {
    const known = await journal.knownDependency(id);
    if (known) decisions.set(id, known);
  }
  return decisions;
};

const projectPending = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  changed: string[],
  blocked: ReadonlySet<string>,
) => {
  const ids = await pendingClosure(journal, changed);
  const views = await journal.canonical(ids);
  const suppressed = new Set(blocked);
  for await (const { operation, requestFingerprint } of pendingOrderedOperations(journal, ids)) {
    if (suppressed.has(operation.operationId)) continue;
    // This is a local projection decision, never a fabricated canonical receipt. A child
    // cannot project structs/observations from a parent already excluded by this rebase.
    if ([...operationDependencies(operation).keys()].some((id) => suppressed.has(id))) {
      suppressed.add(operation.operationId);
      continue;
    }
    const decisions = await knownDependencies(journal, operation);
    let records = isOrderedNativeRequest(requestFingerprint)
      ? await projectOrderedNativeOperation(views, operation, decisions)
      : await projectBoundedOrderedOperation(views, operation, decisions);
    if (!(await canProjectOrderedNumbers(tx, owner, records))) records = [];
    if (!records.length) suppressed.add(operation.operationId);
    const projected = await projectPendingNumberRecords(tx, owner, views, records, operation);
    if (!projected.matches) suppressed.add(operation.operationId);
    for (const record of projected.records) views.set(record.recordId, record);
  }
  return { ids, views };
};

/** Expand atomic-group membership before replaying bounded pending pages in authored order. */
export const rebaseOrderedProjection = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  changed: string[],
) => {
  const { ids, views, events } = await projectWithOrderedNumberPolicy(journal, tx, owner, changed, (ids, blocked) =>
    projectPending(journal, tx, owner, ids, blocked),
  );
  const removed = await removeOrderedProjection(
    tx,
    owner,
    ids.filter((id) => !views.has(id)),
  );
  const saved = await publishOrderedProjection(tx, owner, [...views.values()]);
  await markOrderedNumberProjectionCurrent(tx, owner);
  return { ...saved, projected: saved.projected + removed, views, events };
};
