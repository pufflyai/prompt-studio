import type { AssetStore, StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import type { createDocumentStorageDBService } from "./document-storage";
import { type RecoveryMetadata, textFileIds } from "./recovery-content";
import { type RecoveryRecord, recoveryEdits } from "./recovery-edits";

type Documents = ReturnType<typeof createDocumentStorageDBService>;
export interface SavedOwner {
  records: RecoveryRecord[];
  metadata: RecoveryMetadata;
}
// Keeps each restore commit to a bounded number of record documents.
const groupSize = 100;
const empty: SavedOwner = { records: [], metadata: { texts: {}, dataVersions: [] } };

/** Writes one owner back to its saved content through normal record commits and document edits. */
export const createOwnerRestore = (db: DbClient, documents: Documents) => {
  const textTargets = async (owner: StorageOwner, texts: Record<string, string>) => {
    const ids = new Set([...Object.keys(texts), ...(await textFileIds(db, owner))]);
    return [...ids].map((fileId) => ({
      text: documents.openTextDocument({ owner, fileId }),
      target: texts[fileId] ?? "",
    }));
  };
  const markers = (owner: StorageOwner) =>
    documents.transaction(owner, async ({ document }) => [...document.getMap("data-migrations").keys()]);

  const restoreRecords = async (owner: StorageOwner, saved: RecoveryRecord[], assets: AssetStore | undefined) => {
    const { records } = documents.open({ owner, assets });
    const restoreId = crypto.randomUUID();
    const restored = new Set<string>();
    // A revived record needs a second pass to restore the shared value its document kept.
    for (let pass = 0; pass < 2; pass++) {
      const { edits, revived } = recoveryEdits(await records.list(), saved);
      for (let index = 0; index < edits.length; index += groupSize)
        await records.commit({
          operationId: `recovery:${restoreId}:${pass}:${index}`,
          edits: edits.slice(index, index + groupSize),
        });
      for (const edit of edits) restored.add(edit.recordId);
      if (!revived) break;
    }
    return restored.size;
  };

  const restoreTexts = async (owner: StorageOwner, texts: Record<string, string>) => {
    let changed = false;
    for (const { text, target } of await textTargets(owner, texts)) {
      if ((await text.read()) === target) continue;
      await text.save(target);
      changed = true;
    }
    return changed;
  };

  // Restored records may predate a data migration. Restoring its markers lets the migration run again.
  const restoreDataVersions = (owner: StorageOwner, saved: string[]) =>
    documents.transaction(owner, async ({ document }) => {
      const map = document.getMap("data-migrations");
      const versions = new Set(saved);
      const stale = [...map.keys()].filter((key) => !versions.has(key));
      const missing = saved.filter((key) => !map.has(key));
      document.transact(() => {
        for (const key of stale) map.delete(key);
        for (const key of missing) map.set(key, true);
      });
      return stale.length + missing.length > 0;
    });

  return {
    /** True when every file the saved records refer to is on this device. */
    async hasFiles(saved: SavedOwner, assets: AssetStore | undefined) {
      const files = saved.records.flatMap((record) => (record.asset ? [record.asset] : []));
      if (!files.length) return true;
      if (!assets) return false;
      return assets.verifyComplete(files).then(
        () => true,
        () => false,
      );
    },
    /** True when restoring would change this owner's data. */
    async differs(owner: StorageOwner, saved = empty) {
      const { records } = documents.open({ owner });
      if (recoveryEdits(await records.list(), saved.records).edits.length) return true;
      for (const { text, target } of await textTargets(owner, saved.metadata.texts))
        if ((await text.read()) !== target) return true;
      const current = new Set(await markers(owner));
      return (
        current.size !== saved.metadata.dataVersions.length ||
        saved.metadata.dataVersions.some((key) => !current.has(key))
      );
    },
    async restore(owner: StorageOwner, saved = empty, assets?: AssetStore) {
      const records = await restoreRecords(owner, saved.records, assets);
      const texts = await restoreTexts(owner, saved.metadata.texts);
      const versions = await restoreDataVersions(owner, saved.metadata.dataVersions);
      return { changed: records > 0 || texts || versions, records };
    },
  };
};
