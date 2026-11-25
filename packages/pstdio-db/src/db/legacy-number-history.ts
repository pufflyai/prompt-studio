import type { StorageOwner } from "pstdio-sync";
import { prepareOrderedOperation, resourceNumbers, resourceShorthand } from "pstdio-sync/records";
import { fingerprint, storageLimits } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import { jsonBatches } from "../services/extension-storage/json-batches";
import { createOrderedJournal, withOrderedOwner } from "../services/extension-storage/ordered-journal";
import { numberAlias, numberHistory } from "../services/extension-storage/ordered-number-values";
import { rebaseOrderedProjection } from "../services/extension-storage/ordered-rebase";
import { readProjectedRecords } from "../services/extension-storage/record-queries";
import type { DbClient } from "./connection.pglite";

const legacyHistory = (document: Y.Doc) => {
  const histories = new Map<string, Map<string, number>>();
  const remember = (id: string, shorthand: string) => {
    const number = numberAlias(shorthand);
    if (!number) throw new Error("Invalid retained resource number history");
    const history = histories.get(id) ?? new Map<string, number>();
    history.set(number.prefix, Math.max(history.get(number.prefix) ?? 0, number.value));
    histories.set(id, history);
  };
  for (const key of document.getMap("resource-number-history").keys()) {
    const [id, shorthand] = JSON.parse(key) as [string, string];
    remember(id, shorthand);
  }
  for (const resource of resourceNumbers(document).values()) remember(resource.id, resourceShorthand(resource));
  return [...histories].map(([id, history]) => ({ id, history: Object.fromEntries([...history].sort()) }));
};

/** A removed identity still owns its past allocation floor. Keep it in a deleted core
 * record with private history, without changing that identity's newer body or lifecycle.
 * Ordinary ordered settlement keeps these floors optimistic until Cloud confirms them. */
export const retainLegacyNumberHistory = async (
  db: DbClient,
  owner: StorageOwner,
  document: Y.Doc,
  signal?: AbortSignal,
) => {
  const history = legacyHistory(document);
  for (let offset = 0; offset < history.length; offset += 100) {
    signal?.throwIfAborted();
    const batch = history.slice(offset, offset + 100);
    const canonical = await db.transaction((tx) =>
      createOrderedJournal(tx, owner).canonical(batch.map((row) => row.id)),
    );
    const edits = [];
    for (const row of batch) {
      // A pending replacement may later refuse. Only confirmed history can replace
      // the independent source floor without inheriting that replacement's fate.
      const confirmed = new Map(Object.entries(numberHistory(canonical.get(row.id))));
      if (Object.entries(row.history).every(([prefix, value]) => (confirmed.get(prefix) ?? 0) >= value)) continue;
      const recordId = `legacy-number-history:${await fingerprint([row.id, row.history])}`;
      edits.push({ recordId, deleted: true, base: null, changes: [{ path: ["numberHistory"], set: row.history }] });
    }
    if (!edits.length) continue;
    for (const encoded of jsonBatches(edits)) {
      if (Buffer.byteLength(encoded) > storageLimits.commitBytes)
        throw new Error("Retained legacy number history exceeds the author group limit");
      const selected = JSON.parse(encoded) as typeof edits;
      const identity = await fingerprint(selected);
      const operationId = `number-history-upgrade:${identity}`;
      await withOrderedOwner(db, owner, async (journal, tx) => {
        const previous = await journal.requestIdentity(operationId);
        if (previous) {
          if (previous !== identity) throw new Error("Legacy number history changed after a committed batch");
          return;
        }
        const ids = selected.map((edit) => edit.recordId);
        if (
          (await journal.canonical(ids)).size ||
          (await readProjectedRecords(tx, owner, ids)).some((record) => record.exists) ||
          (await journal.pendingFor(ids, { limit: 1 })).length
        )
          throw new Error("Retained legacy number history conflicts with an existing core record");
        await journal.queue(await prepareOrderedOperation({ operationId, edits: selected }, new Map()), identity);
        await rebaseOrderedProjection(journal, tx, owner, ids);
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
