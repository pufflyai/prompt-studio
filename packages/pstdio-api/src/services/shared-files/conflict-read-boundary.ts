import { AsyncLocalStorage } from "node:async_hooks";
import type { StorageConflict } from "pstdio-sync-contracts";

const boundary = new AsyncLocalStorage<boolean>();

export class ConflictedStorageInputError extends Error {
  constructor(
    readonly recordId: string,
    readonly conflictId: string,
  ) {
    super(`Unresolved storage conflict ${conflictId} blocks input ${recordId}. Inspect and resolve its alternatives.`);
  }
}

export const withConflictReadBoundary = <T>(run: () => T) => boundary.run(true, run);
export const withoutConflictReadBoundary = <T>(run: () => T) => boundary.exit(run);

export const assertConflictFreeRead = (
  recordIds: string[],
  conflicts: Pick<StorageConflict, "recordIds" | "conflictId">[],
) => {
  if (!boundary.getStore()) return;
  for (const recordId of recordIds) {
    const conflict = conflicts.find((entry) => entry.recordIds.includes(recordId));
    if (conflict) throw new ConflictedStorageInputError(recordId, conflict.conflictId);
  }
};
