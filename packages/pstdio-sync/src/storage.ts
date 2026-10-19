import { localOperationSchema, type StorageRecord } from "pstdio-sync-contracts";
import { entryFor, inputFingerprint } from "./authoring";
import { readBranch, workingRecords } from "./branches";
import { pendingOperations, sealOperation } from "./journal";
import { projectGroups } from "./projection";
import { inspectConflict, resolutionEntry } from "./resolution";
import { synchronize } from "./synchronize";
import type { AssetStore, GroupCommit, GroupedStore, RelayAdapter, ResolutionCommit, StorageOwner } from "./types";

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
      list: (
        prefix = "",
        select: (record: Pick<StorageRecord, "recordId" | "value" | "asset" | "deleted">) => boolean = () => true,
      ) =>
        input.store.transaction(input.owner, async (state) => {
          const view = await projectGroups(state, input.environmentId);
          const ids = [...view.records.keys(), ...view.conflicts.flatMap((conflict) => conflict.recordIds)].filter(
            (id) =>
              id.startsWith(prefix) &&
              (select(view.read(id)) ||
                view.conflicts.some((conflict) =>
                  conflict.alternatives.some((alternative) =>
                    alternative.records.some((record) => record.recordId === id && select(record)),
                  ),
                )),
          );
          input.store.observer?.beforeRead?.(input.owner, ids, view.conflicts);
          return [...view.records.keys()]
            .filter((id) => id.startsWith(prefix) && !view.records.get(id)!.deleted && select(view.read(id)))
            .sort()
            .map((id) => readRecord(view.read(id)));
        }),
      outcome: (operationId: string) =>
        input.store.transaction(input.owner, async (state) =>
          (await projectGroups(state, input.environmentId)).outcomes.get(operationId),
        ),
      inspect: (conflictId: string) =>
        input.store.transaction(input.owner, (state) => inspectConflict(state, input.environmentId, conflictId)),
      resolve: async (proposal: ResolutionCommit) => {
        const assets = proposal.edits?.flatMap((edit) => (edit.asset ? [edit.asset] : [])) ?? [];
        if (assets.length) {
          if (!input.assets) throw new Error("Asset verification is unavailable");
          await input.assets.verifyComplete(assets);
        }
        return input.store.transaction(input.owner, async (state) => {
          const previous = state.journal.find((entry) => entry.mutation.operationId === proposal.operationId);
          if (previous && previous.inputFingerprint !== (await inputFingerprint(proposal)))
            throw new Error("Operation identity reused with changed payload");
          if (!previous) {
            const entry = await resolutionEntry(state, proposal, input.environmentId);
            localOperationSchema.parse(entry.mutation);
            state.journal.push(entry);
          }
          return (await projectGroups(state, input.environmentId)).outcomes.get(proposal.operationId)!;
        });
      },
      read: (recordId: string, options?: { operationId: string }) =>
        input.store.transaction(input.owner, async (state) => {
          const view = await projectGroups(state, input.environmentId);
          input.store.observer?.beforeRead?.(input.owner, [recordId], view.conflicts);
          if (!options) return readRecord(view.read(recordId));
          return readBranch(state, input.environmentId, recordId, options.operationId);
        }),
      conflicts: () =>
        input.store.transaction(input.owner, async (state) =>
          (await projectGroups(state, input.environmentId)).conflicts.map(
            ({ conflictId, revision, reason, recordIds, alternativeOperationIds }) => ({
              conflictId,
              revision,
              reason,
              recordIds,
              alternativeOperationIds,
            }),
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
          return outcome;
        });
      },
    },
  };
};
