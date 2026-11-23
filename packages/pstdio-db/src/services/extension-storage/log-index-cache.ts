import type { StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import type { OrderedIndexBlobs } from "pstdio-sync/relay";
import type { IndexNodeFiles } from "./index-node-files";
import { createOrderedManifestCache } from "./ordered-receipts-blobs";

/** Each log owner keeps at most this many bytes of relay index nodes on the device. */
export const LOG_INDEX_CACHE_BYTES = 128 * 1024 * 1024;
// Downloaded nodes can be read before their edges are remembered; keep recent nodes through validation.
const RECENT_MS = 10 * 60 * 1000;
const WRITES_PER_CHECK = 64;

/**
 * Log and history index nodes are a cache of relay data: their roots live on the relay,
 * pending uploads keep their own bytes, and a missing node is downloaded again. The cache is
 * bounded so rebuilt indexes cannot accumulate on the device.
 */
// Each sync builds a new cache over the same files, so counting lives with the files and owner.
const accounting = new WeakMap<IndexNodeFiles, Map<string, { writes: number; evicting: boolean }>>();

export const createLogIndexCache = (
  files: IndexNodeFiles,
  owner: StorageOwner,
  space: SyncSpace,
  remote: OrderedIndexBlobs,
  budgetBytes = LOG_INDEX_CACHE_BYTES,
): OrderedIndexBlobs => {
  const { blobs } = createOrderedManifestCache(files, owner, "logs", space, remote);
  const key = JSON.stringify([owner.workbenchId, owner.extensionId]);
  const owners = accounting.get(files) ?? new Map<string, { writes: number; evicting: boolean }>();
  accounting.set(files, owners);
  const state = owners.get(key) ?? { writes: 0, evicting: false };
  owners.set(key, state);
  const written = () => {
    if (++state.writes % WRITES_PER_CHECK || state.evicting) return;
    state.evicting = true;
    files
      .evict(owner, "logs", budgetBytes, RECENT_MS)
      .catch((error: unknown) => console.warn("Log index cache eviction failed; it retries later.", error))
      .finally(() => {
        state.evicting = false;
      });
  };
  return {
    ...blobs,
    async get(id, extent) {
      const cached = await files.read(owner, "logs", id);
      const bytes = await blobs.get(id, extent);
      if (!cached) written();
      return bytes;
    },
    async put(id, bytes, children, edges) {
      await blobs.put(id, bytes, children, edges);
      written();
    },
  };
};
