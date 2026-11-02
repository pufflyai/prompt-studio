import { encodeText } from "../shared";
import { orderOperations } from "./graph";
import { pendingOperations } from "./journal";
import { projectGroups } from "./projection";
import { applyRecordChange, blankRecord, publicRecord } from "./records";
import type { GroupedState } from "./types";

export const workingRecords = (state: GroupedState, environmentId: string) => {
  const pending = pendingOperations(state, environmentId);
  const replaced = new Set(pending.flatMap((operation) => operation.resolution?.capturedOperationIds ?? []));
  const records = new Map(Object.entries(structuredClone(state.accepted?.records ?? {})));
  for (const mutation of pending) {
    if (replaced.has(mutation.operationId)) continue;
    for (const change of mutation.changes)
      records.set(
        change.recordId,
        applyRecordChange(records.get(change.recordId) ?? blankRecord(change.recordId), change),
      );
  }
  return Object.fromEntries(records);
};

const ancestors = (state: GroupedState, operationId: string) => {
  const available = new Map(state.journal.map((entry) => [entry.mutation.operationId, entry.mutation]));
  const required = new Set([operationId]);
  for (const id of required) {
    const operation = available.get(id);
    if (!operation) throw new Error("Branch operation is unavailable");
    for (const parent of operation.parents)
      if (state.accepted?.receipts[parent]?.status !== "accepted") required.add(parent);
  }
  return orderOperations(available, required);
};

export const readBranch = async (state: GroupedState, environmentId: string, recordId: string, operationId: string) => {
  const view = await projectGroups(state, environmentId);
  const applied = new Set([...view.operations.values()].flat());
  const branch = ancestors(state, operationId);
  const replaced = new Set(branch.flatMap((mutation) => mutation.resolution?.capturedOperationIds ?? []));
  for (const mutation of branch) {
    if (replaced.has(mutation.operationId)) continue;
    if (applied.has(mutation.operationId)) continue;
    for (const change of mutation.changes) {
      view.records.set(
        change.recordId,
        applyRecordChange(view.records.get(change.recordId) ?? blankRecord(change.recordId), change),
      );
      view.operations.set(change.recordId, [...(view.operations.get(change.recordId) ?? []), mutation.operationId]);
    }
    applied.add(mutation.operationId);
  }
  return {
    ...publicRecord(view.records.get(recordId) ?? blankRecord(recordId)),
    revision: encodeText(
      JSON.stringify({ owner: state.owner, recordId, operations: view.operations.get(recordId) ?? [] }),
    ),
  };
};
