import type { Receipt, StoredRecord, SyncOutcome } from "pstdio-sync-contracts";
import type { StorageOwner } from "../shared";
import { encodeText } from "../shared";
import { completedOperations } from "./journal";
import { applyRecordChange, blankRecord, publicRecord, recordConflict } from "./records";
import { resolutionProblem, retainAfterResolution } from "./resolution-preflight";
import type { GroupedState, JournalEntry, LocalOperation } from "./types";

const receiptOutcome = (state: GroupedState, receipt: Receipt) => {
  if (receipt.status === "accepted")
    return { status: "synchronized" as const, operationId: receipt.operationId, checkpoint: receipt.checkpoint! };
  if (receipt.status === "conflict")
    return {
      status: "conflict" as const,
      operationId: receipt.operationId,
      conflictId: receipt.conflictId!,
      conflictRevision: state.accepted!.conflicts[receipt.conflictId!].revision,
    };
  return {
    status: "pending" as const,
    operationId: receipt.operationId,
    reason: receipt.reason ?? "awaiting dependency",
  };
};

const acceptedProjection = (state: GroupedState) => {
  const records = new Map<string, StoredRecord>(Object.entries(structuredClone(state.accepted?.records ?? {})));
  const operations = new Map<string, string[]>();
  const outcomes = new Map<string, SyncOutcome>();
  const receipts = Object.values(state.accepted?.receipts ?? {}).sort(
    (left, right) => (left.checkpoint?.sequence ?? 0) - (right.checkpoint?.sequence ?? 0),
  );
  for (const receipt of receipts) {
    outcomes.set(receipt.operationId, receiptOutcome(state, receipt));
    if (receipt.status === "accepted")
      for (const change of receipt.mutation.changes)
        operations.set(change.recordId, [...(operations.get(change.recordId) ?? []), receipt.operationId]);
  }
  return {
    records,
    operations,
    outcomes,
    applied: new Set(receipts.filter((receipt) => receipt.status === "accepted").map((receipt) => receipt.operationId)),
    completed: completedOperations(state.accepted),
    conflicts: new Map(
      Object.values(state.accepted?.conflicts ?? {})
        .filter((conflict) => !conflict.resolvedBy)
        .map((conflict) => [
          conflict.conflictId,
          {
            ...structuredClone(conflict),
            reason: "Retained alternative",
            alternatives: [] as { operationId: string; records: StoredRecord[] }[],
          },
        ]),
    ),
  };
};
export type Projection = ReturnType<typeof acceptedProjection>;

const addConflict = (view: Projection, mutation: LocalOperation, conflictId: string, reason: string) => {
  const conflict = view.conflicts.get(conflictId) ?? {
    conflictId,
    reason,
    revision: 1,
    recordIds: mutation.changes.map((change) => change.recordId),
    alternativeOperationIds: [],
    alternatives: [],
  };
  if (!conflict.alternativeOperationIds.includes(mutation.operationId))
    conflict.alternativeOperationIds.push(mutation.operationId);
  conflict.alternatives.push({
    operationId: mutation.operationId,
    records: mutation.changes.map((change) =>
      applyRecordChange(view.records.get(change.recordId) ?? blankRecord(change.recordId), change),
    ),
  });
  view.conflicts.set(conflictId, conflict);
  view.outcomes.set(mutation.operationId, {
    status: "conflict",
    operationId: mutation.operationId,
    conflictId,
    conflictRevision: conflict.revision,
  });
};

const localOutcome = (state: GroupedState, entry: JournalEntry) => {
  const operationId = entry.mutation.operationId;
  if (!state.accepted) return { status: "saved-locally" as const, operationId };
  if (entry.acceptance?.checkpoint.epoch === state.accepted.checkpoint.epoch)
    return { status: "synchronized" as const, operationId, checkpoint: entry.acceptance.checkpoint };
  return { status: "pending" as const, operationId, reason: "awaiting relay acceptance" };
};

const operationProblem = async (view: Projection, state: GroupedState, mutation: LocalOperation) => {
  if (mutation.resolution) return resolutionProblem(view, state, mutation);
  const blocked = mutation.parents.map((id) => view.outcomes.get(id)).find((outcome) => outcome?.status === "conflict");
  if (blocked) return "Unaccepted dependency";
  const problems = await Promise.all(
    mutation.changes.map((change) =>
      recordConflict(view.records.get(change.recordId) ?? blankRecord(change.recordId), change),
    ),
  );
  return problems.find((problem) => problem !== undefined);
};

const advanceConflicts = (view: Projection, mutation: LocalOperation) => {
  for (const conflict of view.conflicts.values())
    if (mutation.changes.some((change) => conflict.recordIds.includes(change.recordId))) conflict.revision++;
};

const waitingForParent = (view: Projection, mutation: LocalOperation) => {
  const captured = new Set(mutation.resolution?.capturedOperationIds ?? []);
  return mutation.parents.some(
    (id) => !captured.has(id) && !view.applied.has(id) && view.outcomes.get(id)?.status !== "conflict",
  );
};

const applyOperation = (view: Projection, mutation: LocalOperation) => {
  if (mutation.resolution) retainAfterResolution(view, mutation);
  for (const change of mutation.changes) {
    view.records.set(
      change.recordId,
      applyRecordChange(view.records.get(change.recordId) ?? blankRecord(change.recordId), change),
    );
    view.operations.set(change.recordId, [...(view.operations.get(change.recordId) ?? []), mutation.operationId]);
  }
  view.applied.add(mutation.operationId);
};

const projectOperation = async (view: Projection, state: GroupedState, entry: JournalEntry, environmentId: string) => {
  const mutation = entry.mutation;
  if (view.completed.has(mutation.operationId)) return;
  const known = state.accepted?.receipts[mutation.operationId];
  const retained =
    known?.status === "conflict"
      ? Object.values(state.accepted!.conflicts).find(
          (conflict) => !conflict.resolvedBy && conflict.alternativeOperationIds.includes(mutation.operationId),
        )
      : undefined;
  if (mutation.environmentId !== environmentId && !entry.acceptance && known?.status !== "conflict") return;
  if (known?.status !== "conflict" && waitingForParent(view, mutation)) {
    view.outcomes.set(mutation.operationId, {
      status: "pending",
      operationId: mutation.operationId,
      reason: "awaiting dependency",
    });
    return;
  }
  const blocked = mutation.parents.map((id) => view.outcomes.get(id)).find((outcome) => outcome?.status === "conflict");
  const problem = await operationProblem(view, state, mutation);
  if (!known && !blocked) advanceConflicts(view, mutation);
  if (known?.status === "conflict" || problem) {
    addConflict(
      view,
      mutation,
      retained?.conflictId ??
        (mutation.resolution && view.conflicts.has(mutation.resolution.conflictId)
          ? mutation.resolution.conflictId
          : undefined) ??
        blocked?.conflictId ??
        mutation.operationId,
      problem ?? "Unaccepted dependency",
    );
    return;
  }
  applyOperation(view, mutation);
  view.outcomes.set(mutation.operationId, localOutcome(state, entry));
};

const projectedRecords = (view: Projection, owner: StorageOwner) => {
  const read = (recordId: string) => ({
    ...publicRecord(view.records.get(recordId) ?? blankRecord(recordId)),
    revision: encodeText(JSON.stringify({ owner, recordId, operations: view.operations.get(recordId) ?? [] })),
  });
  return {
    read,
    source: view,
    records: view.records,
    operations: view.operations,
    outcomes: view.outcomes,
    conflicts: [...view.conflicts.values()],
    completed: view.completed,
  };
};

export const projectGroups = async (state: GroupedState, environmentId: string) => {
  const view = acceptedProjection(state);
  for (const entry of state.journal) await projectOperation(view, state, entry, environmentId);
  return projectedRecords(view, state.owner);
};

export type RecordProjection = ReturnType<typeof projectedRecords>;

export const appendGroups = async (
  current: RecordProjection,
  state: GroupedState,
  environmentId: string,
  entries: JournalEntry[],
) => {
  // Issued views stay immutable, including when the transaction later rolls back.
  const view = structuredClone(current.source);
  for (const entry of structuredClone(entries)) await projectOperation(view, state, entry, environmentId);
  return projectedRecords(view, state.owner);
};
