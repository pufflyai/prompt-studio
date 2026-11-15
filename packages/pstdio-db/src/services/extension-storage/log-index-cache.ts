import type { StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import type { OrderedIndexBlobs } from "pstdio-sync/relay";
import type { IndexNodeFiles } from "./index-node-files";
import { createOrderedManifestCache } from "./ordered-receipts-blobs";

/** Each log owner keeps at most this many bytes of relay index nodes on the device. */
export const LOG_INDEX_CACHE_BYTES = 128 * 1024 * 1024;
// A node is written, then its edges are remembered; recent nodes stay so that pair never splits.
const RECENT_MS = 10 * 60 * 1000;
const WRITES_PER_CHECK = 64;

/**
 * Log and history index nodes are a cache of relay data: their roots live on the relay,
 * pending uploads keep their own bytes, and a missing node is downloaded again. The cache is
 * bounded so rebuilt indexes cannot accumulate on the device.
 */
export const createLogIndexCache = (
  files: IndexNodeFiles,
  owner: StorageOwner,
  space: SyncSpace,
  remote: OrderedIndexBlobs,
  budgetBytes = LOG_INDEX_CACHE_BYTES,
): OrderedIndexBlobs => {
  const { blobs } = createOrderedManifestCache(files, owner, "logs", space, remote);
  let writes = 0;
  let evicting: Promise<unknown> | undefined;
  const written = () => {
    if (++writes % WRITES_PER_CHECK || evicting) return;
    evicting = files.evict(owner, "logs", budgetBytes, RECENT_MS).finally(() => {
      evicting = undefined;
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
    async put(id, bytes, children) {
      await blobs.put(id, bytes, children);
      written();
    },
  };
};
