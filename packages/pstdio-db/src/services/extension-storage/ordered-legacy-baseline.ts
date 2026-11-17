import type { StorageOwner } from "pstdio-sync";
import {
  applyJsonChanges,
  type OrderedOperation,
  type OrderedRecord,
  parseJsonPointer,
  readOrderedPath,
} from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";
import { minimalLegacyPaths } from "./ordered-legacy-paths";
import { indexInitialCanonicalNumbers } from "./ordered-number-canonical";
import type { OrderedTransaction } from "./ordered-sql";

const ordinaryRemovals = (record: OrderedRecord, paths: string[][]) => {
  const texts = Object.keys(record.texts ?? {}).map(parseJsonPointer);
  const changes: OrderedOperation["edits"][number]["changes"] = [];
  const pending = [...paths];
  while (pending.length) {
    const path = pending.pop()!;
    if (texts.some((text) => text.length <= path.length && text.every((key, index) => path[index] === key))) continue;
    if (texts.some((text) => path.every((key, index) => text[index] === key))) {
      const value = readOrderedPath(record.value, path);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Legacy text is missing its materialized parent");
      for (const key of Object.keys(value)) pending.push([...path, key]);
    } else changes.push({ path, remove: true });
  }
  return minimalLegacyPaths(changes.map((change) => change.path)).map((path) => ({ path, remove: true as const }));
};

/** Dirty ordinary values belong only to pending groups; holes do not guess an unavailable old base. */
export const stripLegacyPendingPaths = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  dirty: Map<string, string[][]>,
) => {
  const ids = [...dirty.keys()];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const records = await journal.canonical(ids.slice(offset, offset + 100));
    const stripped = [...records.values()].map((record) => ({
      ...record,
      value: applyJsonChanges(record.value, ordinaryRemovals(record, dirty.get(record.recordId)!)),
    }));
    await journal.saveCanonical(stripped);
    await indexInitialCanonicalNumbers(tx, owner, stripped);
  }
};
