import type { StorageOwner } from "pstdio-sync";
import type { createDocumentSync, RecordStreamStore } from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";
import type { documentProgress } from "./document-progress";

export const traceRelayOwnerPhase = async <T>(owner: StorageOwner, phase: string, work: () => Promise<T>) => {
  const started = performance.now();
  try {
    return await work();
  } finally {
    apiLogger.debug(
      { event: "relay.owner.phase", ...owner, phase, elapsedMs: performance.now() - started },
      "Owner storage progress",
    );
  }
};

export const traceDocumentSync = (
  owner: StorageOwner,
  role: "directory" | "document",
  sync: ReturnType<typeof createDocumentSync>,
) => ({
  ...sync,
  async synchronize() {
    const started = performance.now();
    try {
      await sync.synchronize();
    } finally {
      apiLogger.debug(
        { event: "relay.document.phase", ...owner, role, elapsedMs: performance.now() - started },
        "Document storage progress",
      );
    }
  },
});

export const traceDocumentProgress = (
  owner: StorageOwner,
  names: string[],
  statuses: Parameters<typeof documentProgress>[0],
) => {
  const roles = [...names.map((name) => (name === "records" ? "directory" : "document")), "record-stream", "logs"];
  apiLogger.debug(
    {
      event: "relay.document.status",
      ...owner,
      streams: statuses.map((status, index) => ({ role: roles[index], ...status })),
    },
    "Document storage status",
  );
};

/** Report the slow storage phase without logging record IDs, paths or content. */
export const traceRecordStreamStore = (owner: StorageOwner, store: RecordStreamStore) => {
  const finished = (phase: string, started: number) =>
    apiLogger.debug(
      { event: "relay.record-stream.phase", ...owner, phase, elapsedMs: performance.now() - started },
      "Record storage progress",
    );
  const trace =
    <A extends unknown[], T>(phase: string, run: (...args: A) => Promise<T>) =>
    async (...args: A) => {
      const started = performance.now();
      try {
        return await run(...args);
      } finally {
        finished(phase, started);
      }
    };
  return {
    ...store,
    open: trace("open", store.open),
    apply: trace("apply", store.apply),
    merge: trace("merge", store.merge),
    outbox: trace("outbox", store.outbox),
    snapshot: trace("snapshot", store.snapshot),
    published: (...args: Parameters<RecordStreamStore["published"]>) => {
      const started = performance.now();
      return store.published(...args).finally(() => finished("published", started));
    },
  };
};
