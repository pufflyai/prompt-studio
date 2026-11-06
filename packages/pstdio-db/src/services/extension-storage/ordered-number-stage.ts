import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedOperation, type OrderedRecord } from "pstdio-sync/records";
import { repairOrderedNumbers } from "./ordered-number-repair";
import { stageMapUndo } from "./ordered-number-stage-undo";
import { numberAliasIntent, numberHistory, orderedNumber, retainNumberHistory } from "./ordered-number-values";

/** Snapshot staging owns this index. A failed relay CAS cannot mutate durable canonical claims. */
export const createStagedNumberRepair = (owner: StorageOwner, records: Map<string, OrderedRecord>) => {
  const floors = new Map<string, number>();
  const claims = new Map<string, Set<string>>();
  const previousClaims = new Map<string, string>();
  const transaction = () => ({
    records: stageMapUndo(records),
    floors: stageMapUndo(floors),
    claims: stageMapUndo(claims, (value) => new Set(value)),
    previous: stageMapUndo(previousClaims),
  });
  let undo: ReturnType<typeof transaction> | undefined;
  const keyFor = (record: OrderedRecord) => {
    const number = orderedNumber(record);
    return number && JSON.stringify([number.extensionId, number.kind, number.prefix, number.value]);
  };
  const save = async (selected: OrderedRecord[]) => {
    for (const record of selected) {
      undo?.records.remember(record.recordId);
      undo?.previous.remember(record.recordId);
      const old = previousClaims.get(record.recordId);
      if (old) undo?.claims.remember(old);
      if (old) claims.get(old)?.delete(record.recordId);
      previousClaims.delete(record.recordId);
      const retained = retainNumberHistory(undefined, record);
      records.set(record.recordId, retained);
      for (const [prefix, value] of Object.entries(numberHistory(retained))) {
        undo?.floors.remember(prefix);
        floors.set(prefix, Math.max(floors.get(prefix) ?? 0, value));
      }
      const key = keyFor(retained);
      if (!key) continue;
      undo?.claims.remember(key);
      const ids = claims.get(key) ?? new Set<string>();
      ids.add(record.recordId);
      claims.set(key, ids);
      previousClaims.set(record.recordId, key);
    }
  };
  // There is no I/O in save, so initial staged indexing finishes before apply can run.
  void save([...records.values()]);
  return {
    async apply(changed: OrderedRecord[], operation: OrderedOperation, stamp: string) {
      if (owner.extensionId !== coreOwnerId || (!changed.length && !numberAliasIntent(operation))) return changed;
      undo = transaction();
      try {
        return await repairOrderedNumbers(
          {
            read: async (ids) => new Map(ids.flatMap((id) => (records.has(id) ? [[id, records.get(id)!]] : []))),
            save,
            next: async (prefix) => (floors.get(prefix) ?? 0) + 1,
            collisions: async (selected) =>
              [
                ...new Set(
                  selected.flatMap((record) => {
                    const key = keyFor(record);
                    return key ? [...(claims.get(key) ?? [])].sort().slice(1) : [];
                  }),
                ),
              ].sort(),
          },
          changed,
          operation,
          stamp,
        );
      } catch (error) {
        for (const map of Object.values(undo)) map.restore();
        throw error;
      } finally {
        undo = undefined;
      }
    },
  };
};
