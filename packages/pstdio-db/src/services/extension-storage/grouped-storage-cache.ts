import { appendGroups, type GroupedState, type RecordProjection, type StorageOwner } from "pstdio-sync";

interface CachedProjection {
  ownerKey: string;
  environmentId: string;
  revision: string;
  view: RecordProjection;
}

const ownerKey = (owner: StorageOwner) => JSON.stringify([owner.workbenchId, owner.extensionId]);
const cacheKey = (owner: StorageOwner, environmentId: string) => JSON.stringify([ownerKey(owner), environmentId]);

/** Disposable, bounded projections. Only the database owner revision authorizes reuse. */
export const createGroupedStorageCache = () => {
  const entries = new Map<string, CachedProjection>();
  const put = (key: string, entry: CachedProjection) => {
    entries.delete(key);
    entries.set(key, entry);
    if (entries.size > 32) entries.delete(entries.keys().next().value!);
  };
  return {
    get(owner: StorageOwner, environmentId: string, revision: string) {
      const key = cacheKey(owner, environmentId);
      const entry = entries.get(key);
      if (!entry || entry.revision !== revision) return undefined;
      put(key, entry);
      return entry.view;
    },
    set(owner: StorageOwner, environmentId: string, revision: string, view: RecordProjection) {
      put(cacheKey(owner, environmentId), { ownerKey: ownerKey(owner), environmentId, revision, view });
    },
    async prepare(state: GroupedState, previous: string, revision: string, appendedFrom: number | null) {
      const ready: [string, CachedProjection][] = [];
      for (const [key, entry] of entries) {
        if (entry.ownerKey !== ownerKey(state.owner)) continue;
        // Only the new immutable view may be published after commit.
        entries.delete(key);
        if (entry.revision !== previous || appendedFrom === null) continue;
        const view = await appendGroups(entry.view, state, entry.environmentId, state.journal.slice(appendedFrom));
        ready.push([key, { ...entry, revision, view }]);
      }
      // Publish only after COMMIT. Rollback simply discards this disposable work.
      return () => {
        for (const [key, entry] of ready) put(key, entry);
      };
    },
  };
};
