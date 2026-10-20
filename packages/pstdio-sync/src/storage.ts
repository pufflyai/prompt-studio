import { localOperationSchema, type SyncOutcome } from "pstdio-sync-contracts";
import { entryFor, inputFingerprint } from "./authoring";
import { readBranch, workingRecords } from "./branches";
import { pendingOperations, sealOperation } from "./journal";
import { projectGroups } from "./projection";
import { inspectConflict, resolutionEntry } from "./resolution";
import { synchronize } from "./synchronize";
import type { AssetStore, GroupCommit, GroupedStore, RelayAdapter, ResolutionCommit, StorageOwner } from "./types";

// Relay conflicts still exist until the merging store replaces the journal; they need attention.
const saveStates = {
  "saved-locally": "saved-locally",
  pending: "waiting-to-sync",
  synchronized: "synced",
  conflict: "needs-attention",
} as const;
const saveOutcome = (outcome: SyncOutcome) => ({ ...outcome, state: saveStates[outcome.status] });

export const createRecordStorage = (input: {
  store: GroupedStore;
  owner: StorageOwner;
  environmentId: string;
  assets?: AssetStore;
}) => {
  const readRecord = <T extends { recordId: string; revision: string }>(record: T) => {
    input.store.observer?.read(input.owner, record);
    return record;
  };
  const projection = () =>
    input.store.project?.(input.owner, input.environmentId) ??
    input.store.transaction(input.owner, (state) => projectGroups(state, input.environmentId));
  return {
    synchronize: (adapter: RelayAdapter) => synchronize(input, adapter),
    readState: () =>
      input.store.transaction(input.owner, async (state) => {
        const snapshot = structuredClone(state);
        return {
          ...snapshot,
          pending: pendingOperations(snapshot, input.environmentId),
          working: workingRecords(snapshot, input.environmentId),
        };
      }),
    mutation: (operationId: string) =>
      input.store.transaction(input.owner, async (state) => {
        const entry = state.journal.find((entry) => entry.mutation.operationId === operationId);
        if (!entry) throw new Error("Operation not found");
        return sealOperation(state, entry.mutation);
      }),
    records: {
      list: () =>
        projection().then((view) => {
          return [...view.records.keys()]
            .filter((id) => !view.records.get(id)!.deleted)
            .sort()
            .map((id) => readRecord(view.read(id)));
        }),
      outcome: (operationId: string) =>
        projection().then((view) => {
          const outcome = view.outcomes.get(operationId);
          return outcome && saveOutcome(structuredClone(outcome));
        }),
      inspect: (conflictId: string) =>
        input.store.transaction(input.owner, (state) => inspectConflict(state, input.environmentId, conflictId)),
      resolve: (proposal: ResolutionCommit) =>
        input.store.transaction(input.owner, async (state) => {
          const previous = state.journal.find((entry) => entry.mutation.operationId === proposal.operationId);
          if (previous && previous.inputFingerprint !== (await inputFingerprint(proposal)))
            throw new Error("Operation identity reused with changed payload");
          if (!previous) {
            const entry = await resolutionEntry(state, proposal, input.environmentId);
            localOperationSchema.parse(entry.mutation);
            state.journal.push(entry);
          }
          return saveOutcome((await projectGroups(state, input.environmentId)).outcomes.get(proposal.operationId)!);
        }),
      read: (recordId: string, options?: { operationId: string }) => {
        if (!options) return projection().then((view) => readRecord(view.read(recordId)));
        return input.store.transaction(input.owner, (state) =>
          readBranch(state, input.environmentId, recordId, options.operationId),
        );
      },
      conflicts: () =>
        projection().then((view) =>
          structuredClone(
            view.conflicts.map(({ conflictId, revision, reason, recordIds, alternativeOperationIds }) => ({
              conflictId,
              revision,
              reason,
              recordIds,
              alternativeOperationIds,
            })),
          ),
        ),
      commit: async (proposal: GroupCommit) => {
        const group = input.store.observer?.group(input.owner, proposal) ?? proposal;
        const assets = group.edits.flatMap((edit) => (edit.asset ? [edit.asset] : []));
        if (assets.length) {
          if (!input.assets) throw new Error("Asset verification is unavailable");
          await input.assets.verifyComplete(assets);
        }
        return input.store.transaction(input.owner, async (state) => {
          const previous = state.journal.find((entry) => entry.mutation.operationId === group.operationId);
          if (previous && previous.inputFingerprint !== (await inputFingerprint(group)))
            throw new Error("Operation identity reused with changed payload");
          if (!previous) {
            const entry = await entryFor(state, group, input.environmentId);
            localOperationSchema.parse(entry.mutation);
            state.journal.push(entry);
          }
          const view = await projectGroups(state, input.environmentId);
          const outcome = view.outcomes.get(group.operationId)!;
          input.store.observer?.committed(
            input.owner,
            group.edits.map((edit) => view.read(edit.recordId)),
            outcome,
          );
          return saveOutcome(outcome);
        });
      },
    },
  };
};
