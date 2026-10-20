import { fingerprint, type Json } from "pstdio-sync-contracts";
import { decodeText } from "./encoding";
import { projectGroups } from "./projection";
import { applyRecordChange, blankRecord, sharedChange } from "./records";
import type { GroupCommit, GroupedState, ResolutionCommit, StorageOwner } from "./types";

export const recordVersion = (state: GroupedState, recordId: string, captured: string) => {
  const token = JSON.parse(decodeText(captured)) as { owner: StorageOwner; recordId: string; operations: string[] };
  if (token.owner.workbenchId !== state.owner.workbenchId || token.owner.extensionId !== state.owner.extensionId)
    throw new Error("Revision belongs to another storage owner");
  if (token.recordId !== recordId) throw new Error("Revision belongs to another record");
  let record = blankRecord(recordId);
  for (const operationId of token.operations) {
    const entry = state.journal.find((entry) => entry.mutation.operationId === operationId);
    if (!entry) throw new Error("Unknown record revision");
    const change = entry.mutation.changes.find((change) => change.recordId === recordId);
    if (change) record = applyRecordChange(record, change);
  }
  return { record, operations: token.operations };
};

export const authorGroup = async (state: GroupedState, input: GroupCommit, environmentId: string) => {
  const parents = new Set<string>();
  const view = await projectGroups(state, environmentId);
  const changes = await Promise.all(
    input.edits.map(async (edit) => {
      const base = recordVersion(state, edit.recordId, edit.expectedRevision ?? view.read(edit.recordId).revision);
      for (const id of base.operations) if (!view.completed.has(id)) parents.add(id);
      return {
        recordId: edit.recordId,
        expectedRevision: base.record.revision,
        baseDeleted: base.record.deleted,
        ...(Object.hasOwn(edit, "replace") && {
          value: { expected: await fingerprint(base.record.value), next: edit.replace! },
        }),
        ...(edit.shared && { shared: await sharedChange(base.record, edit.shared) }),
        ...(edit.asset !== undefined && { asset: { base: base.record.asset, next: edit.asset } }),
        ...(edit.deleted !== undefined && { deleted: edit.deleted }),
      };
    }),
  );
  return { operationId: input.operationId, environmentId, parents: [...parents], changes };
};

export const inputFingerprint = (input: GroupCommit | ResolutionCommit) => fingerprint(input as unknown as Json);
export const entryFor = async (state: GroupedState, input: GroupCommit, environmentId: string) => ({
  inputFingerprint: await inputFingerprint(input),
  mutation: await authorGroup(state, input, environmentId),
});
