import type { StorageOwner } from "pstdio-sync";
import type { RecordStreamStore } from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";

/** Report the slow storage phase without logging record IDs, paths or content. */
export const traceRecordStreamStore = (owner: StorageOwner, store: RecordStreamStore) => {
  const trace =
    <A extends unknown[], T>(phase: string, run: (...args: A) => T) =>
    async (...args: A) => {
      const started = performance.now();
      try {
        return await run(...args);
      } finally {
        apiLogger.debug(
          { event: "relay.record-stream.phase", ...owner, phase, elapsedMs: performance.now() - started },
          "Record storage progress",
        );
      }
    };
  return {
    ...store,
    open: trace("open", store.open),
    apply: trace("apply", store.apply),
    merge: trace("merge", store.merge),
    outbox: trace("outbox", store.outbox),
    snapshot: trace("snapshot", store.snapshot),
    published: trace("published", store.published),
  };
};
