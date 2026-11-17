import type { StorageCurrentGroup, StorageRecord, StorageSaveOutcome } from "pstdio-sync-contracts";
import type { GroupCommit } from "./types";

type CurrentRecords = {
  read(id: string): Promise<StorageRecord>;
  readMany?: (ids: string[]) => Promise<StorageRecord[]>;
  outcome(id: string): Promise<StorageSaveOutcome | undefined>;
  commit(group: GroupCommit): Promise<StorageSaveOutcome>;
};

/** A local condition must not become a whole-record relay condition that drops unrelated concurrent edits. */
export const commitCurrentBatch = async (
  storage: { transaction<T>(run: (records: CurrentRecords) => Promise<T>): Promise<T> },
  input: StorageCurrentGroup,
) => {
  const group = structuredClone(input);
  if (!group.edits.length || group.edits.length > 100) throw new Error("Compare 1–100 records per save");
  if (group.edits.some((edit) => typeof edit.expectedRevision !== "string" || !edit.expectedRevision))
    throw new Error("Every compared record requires its observed revision");
  const ids = group.edits.map(({ recordId }) => recordId);
  if (new Set(ids).size !== ids.length) throw new Error("Compare each record once per save");
  const save = {
    ...group,
    edits: group.edits.map(({ expectedRevision, ...edit }) => ({
      ...edit,
      observedRevision: expectedRevision,
      expectedLifetime: expectedRevision,
    })),
  };
  return storage.transaction(async (records) => {
    // Replaying an accepted request still checks operation identity through commit.
    if (await records.outcome(group.operationId)) return records.commit(save);
    const current = records.readMany
      ? await records.readMany(ids)
      : await Promise.all(ids.map((id) => records.read(id)));
    if (
      current.some((row, index) => !row.exists || row.deleted || row.revision !== group.edits[index]!.expectedRevision)
    )
      return null;
    return records.commit(save);
  });
};
