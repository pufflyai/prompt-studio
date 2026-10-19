import type { RecordEdit } from "../authoring";
import { fingerprint, sealMutation } from "../fingerprint";
import type { Mutation, Scope } from "../wire";
import { captureBranch } from "./capture-branch";
import { own, put } from "./dictionary";
import { applyChange, blank, sharedChange } from "./documents";
import type { LocalState } from "./local-store";

export function working(state: LocalState) {
  const records = structuredClone(state.accepted.records);
  const replaced = new Set(state.pending.flatMap((mutation) => mutation.resolution?.capturedOperationIds ?? []));
  for (const mutation of state.pending.filter((mutation) => !replaced.has(mutation.operationId)))
    for (const change of mutation.changes) {
      put(records, change.recordId, applyChange(own(records, change.recordId) ?? blank(change.recordId), change));
    }
  return records;
}

export async function edit(state: LocalState, scope: Scope, environmentId: string, edits: RecordEdit[]) {
  const view = working(state);
  const ids = new Set(edits.map((input) => input.recordId));
  const superseded = new Set(state.pending.flatMap((mutation) => mutation.resolution?.capturedOperationIds ?? []));
  const parents = state.pending
    .filter(
      (mutation) =>
        !superseded.has(mutation.operationId) && mutation.changes.some((change) => ids.has(change.recordId)),
    )
    .map((mutation) => mutation.operationId);
  const changes = await Promise.all(
    edits.map(async (input) => {
      const current = own(view, input.recordId) ?? blank(input.recordId);
      return {
        recordId: input.recordId,
        expectedRevision: current.revision,
        baseDeleted: current.deleted,
        ...(input.shared && { shared: await sharedChange(current, input.shared) }),
        ...(input.replace !== undefined && {
          value: { expected: await fingerprint(current.value), next: input.replace },
        }),
        ...(input.asset !== undefined && { asset: { base: current.asset, next: input.asset } }),
        ...(input.deleted !== undefined && { deleted: input.deleted }),
      };
    }),
  );
  const mutation = await sealMutation({
    protocolVersion: 2,
    epoch: state.accepted.checkpoint.epoch,
    generation: state.accepted.generation,
    sequence:
      Math.max(
        0,
        ...[...state.pending, ...Object.values(state.accepted.receipts).map((receipt) => receipt.mutation)]
          .filter((group) => group.environmentId === environmentId)
          .map((group) => group.sequence),
      ) + 1,
    scope,
    environmentId,
    operationId: crypto.randomUUID(),
    parents,
    changes,
  });
  state.pending.push(mutation);
  return mutation;
}

export async function resolve(
  state: LocalState,
  scope: Scope,
  environmentId: string,
  conflictId: string,
  choose: "local" | "remote",
  handler?: { publishedRevision: string; handlerId: string },
) {
  const conflict = own(state.accepted.conflicts, conflictId);
  if (!conflict || conflict.resolvedBy) throw new Error("no unresolved conflict");
  const branch = captureBranch(state, conflictId);
  const captured = new Set(branch.map((mutation) => mutation.operationId));
  const expectedConflicts = Object.values(state.accepted.conflicts)
    .filter((input) => input.alternativeOperationIds.some((id) => captured.has(id)))
    .map((input) => ({ conflictId: input.conflictId, revision: input.revision }));
  const view = working({ ...state, pending: branch });
  const ids = [...new Set(branch.flatMap((mutation) => mutation.changes.map((change) => change.recordId)))];
  const changes = await Promise.all(
    ids.map(async (recordId) => {
      const current = own(state.accepted.records, recordId) ?? blank(recordId);
      const draft = own(view, recordId)!;
      const selected = choose === "local" ? draft : current;
      const primitiveSource = choose === "remote" && current.primitive !== draft.primitive ? current : draft;
      let shared: Mutation["changes"][number]["shared"];
      if (primitiveSource.shared && primitiveSource.primitive !== "map") shared = primitiveSource.shared;
      if (primitiveSource.primitive === "map") {
        shared = {
          kind: "map",
          entries: await Promise.all(
            [...new Set([...Object.keys(primitiveSource.map), ...Object.keys(current.map)])].map(async (key) => ({
              key,
              expected: await fingerprint(null),
              next: Object.hasOwn(selected.map, key)
                ? { kind: "set" as const, value: selected.map[key] }
                : { kind: "delete" as const },
            })),
          ),
        };
        if (shared.entries.length === 0) shared = undefined;
      }
      return {
        recordId,
        expectedRevision: current.revision,
        baseDeleted: current.deleted,
        shared,
        value: { expected: await fingerprint(current.value), next: selected.value },
        asset: { base: current.asset, next: selected.asset },
        deleted: selected.deleted,
      };
    }),
  );
  const mutation = await sealMutation({
    protocolVersion: 2,
    epoch: state.accepted.checkpoint.epoch,
    generation: state.accepted.generation,
    sequence:
      Math.max(
        0,
        ...[...state.pending, ...Object.values(state.accepted.receipts).map((receipt) => receipt.mutation)]
          .filter((group) => group.environmentId === environmentId)
          .map((group) => group.sequence),
      ) + 1,
    scope,
    environmentId,
    operationId: crypto.randomUUID(),
    parents: [...captured],
    changes,
    resolution: {
      conflictId,
      expectedConflicts,
      capturedOperationIds: [...captured],
      expectedInputs: ids.map((recordId) => ({
        recordId,
        revision: own(state.accepted.records, recordId)?.revision ?? 0,
      })),
      ...(handler && { handler }),
    },
  });
  state.pending.push(mutation);
  return mutation;
}
