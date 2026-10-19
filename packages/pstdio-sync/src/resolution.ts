import { type Change, fingerprint, type SharedEdit, type StoredRecord } from "pstdio-sync-contracts";
import { inputFingerprint, recordVersion } from "./authoring";
import { readBranch } from "./branches";
import { captureBranch } from "./capture";
import { projectGroups } from "./projection";
import { applyRecordChange, sharedChange } from "./records";
import { resolutionGuards } from "./resolution-preflight";
import type { GroupedState, LocalOperation, ResolutionCommit } from "./types";

export const inspectConflict = async (state: GroupedState, environmentId: string, conflictId: string) => {
  const known = state.accepted?.conflicts[conflictId];
  const view = await projectGroups(state, environmentId);
  const conflict = view.conflicts.find((entry) => entry.conflictId === conflictId);
  if (!conflict || ("resolvedBy" in conflict && conflict.resolvedBy)) throw new Error("No unresolved conflict");
  const published = new Set(
    [...view.outcomes].filter(([, outcome]) => outcome.status !== "conflict").map(([id]) => id),
  );
  const branch = captureBranch(state, environmentId, conflictId, known ? undefined : published);
  const captured = new Set(branch.map((mutation) => mutation.operationId));
  const ids = [...new Set(branch.flatMap((mutation) => mutation.changes.map((change) => change.recordId)))];

  const accepted = ids.map(view.read);
  return {
    conflictId,
    revision: conflict.revision,
    expectedConflicts: [...resolutionGuards(state, view.conflicts).values()]
      .filter((entry) => entry.alternativeOperationIds.some((id) => captured.has(id)))
      .map((entry) => ({ conflictId: entry.conflictId, revision: entry.revision })),
    capturedOperationIds: [...captured],
    expectedInputs: accepted.map(({ recordId, revision }) => ({ recordId, revision })),
    accepted,
    alternatives: await Promise.all(
      branch.map(async (mutation) => ({
        operationId: mutation.operationId,
        parents: mutation.parents,
        records: await Promise.all(
          mutation.changes.map((change) => readBranch(state, environmentId, change.recordId, mutation.operationId)),
        ),
      })),
    ),
  };
};

const resolutionShared = async (
  current: StoredRecord,
  draft: StoredRecord,
  choose: ResolutionCommit["choose"],
  edits?: SharedEdit[],
) => {
  let selected = choose === "local" ? draft : current;
  let source = choose === "remote" && current.primitive !== draft.primitive ? current : draft;
  if (edits) {
    // Sequence updates carry captured ancestry even when the atomic value chooses the accepted side.
    if (draft.primitive === "text" || draft.primitive === "list") source = draft;
    const base = source.primitive === "map" ? selected : source;
    selected = applyRecordChange(base, {
      recordId: base.recordId,
      expectedRevision: base.revision,
      baseDeleted: base.deleted,
      shared: await sharedChange(base, edits),
    });
    if (selected.primitive !== "map") source = selected;
  }
  if (source.primitive !== "map") return source.shared;
  const keys = [...new Set([...Object.keys(source.map), ...Object.keys(current.map), ...Object.keys(selected.map)])];
  if (!keys.length) return undefined;
  const entries = await Promise.all(
    keys.map(async (key) => ({
      key,
      expected: await fingerprint(null),
      next: Object.hasOwn(selected.map, key)
        ? { kind: "set" as const, value: selected.map[key] }
        : { kind: "delete" as const },
    })),
  );
  return { kind: "map" as const, entries };
};

export const resolutionEntry = async (state: GroupedState, input: ResolutionCommit, environmentId: string) => {
  const available = new Map(state.journal.map((entry) => [entry.mutation.operationId, entry.mutation]));
  const branch = input.capturedOperationIds.map((id) => {
    const operation = available.get(id);
    if (!operation) throw new Error("Captured branch is unavailable");
    return operation;
  });
  const ids = [...new Set(branch.flatMap((mutation) => mutation.changes.map((change) => change.recordId)))];
  if (
    input.edits &&
    (input.edits.length !== ids.length ||
      new Set(input.edits.map((edit) => edit.recordId)).size !== ids.length ||
      ids.some((id) => !input.edits!.some((edit) => edit.recordId === id)))
  )
    throw new Error("Domain merge must cover every captured record exactly once");
  if (input.expectedInputs.length !== ids.length) throw new Error("Resolution inputs must cover every captured record");
  const replaced = new Set(branch.flatMap((mutation) => mutation.resolution?.capturedOperationIds ?? []));
  const current = new Map(
    ids.map((id) => {
      const expected = input.expectedInputs.find((entry) => entry.recordId === id);
      if (!expected) throw new Error("Resolution input is unavailable");
      return [id, recordVersion(state, id, expected.revision).record];
    }),
  );
  const draft = new Map([...current].map(([id, record]) => [id, structuredClone(record)]));
  for (const mutation of branch) {
    if (replaced.has(mutation.operationId)) continue;
    for (const change of mutation.changes)
      draft.set(change.recordId, applyRecordChange(draft.get(change.recordId)!, change));
  }
  const changes: Change[] = await Promise.all(
    ids.map(async (recordId) => {
      const base = current.get(recordId)!;
      const alternative = draft.get(recordId)!;
      const selected = input.choose === "local" ? alternative : base;
      const edit = input.edits?.find((edit) => edit.recordId === recordId);
      return {
        recordId,
        expectedRevision: base.revision,
        baseDeleted: base.deleted,
        shared: await resolutionShared(base, alternative, input.choose, edit?.shared),
        value: {
          expected: await fingerprint(base.value),
          next: edit && Object.hasOwn(edit, "replace") ? edit.replace! : selected.value,
        },
        asset: { base: base.asset, next: edit?.asset === undefined ? selected.asset : edit.asset },
        deleted: edit?.deleted ?? selected.deleted,
      };
    }),
  );
  const mutation: LocalOperation = {
    operationId: input.operationId,
    environmentId,
    parents: input.capturedOperationIds,
    changes,
    resolution: {
      conflictId: input.conflictId,
      expectedConflicts: input.expectedConflicts,
      capturedOperationIds: input.capturedOperationIds,
      expectedInputs: ids.map((recordId) => ({ recordId, revision: current.get(recordId)!.revision })),
      ...(input.handler && { handler: input.handler }),
    },
  };
  return { inputFingerprint: await inputFingerprint(input), mutation };
};
