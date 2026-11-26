import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pruneDocumentFiles } from "../../services/extension-storage/document-file-retention";
import { attachDocumentCollector, documentFilesFor } from "../../services/extension-storage/document-files";
import {
  attachIndexNodeFiles,
  createIndexNodeFiles,
  createMemoryIndexNodeFiles,
} from "../../services/extension-storage/index-node-files";
import { recoveryFilesFor } from "../../services/extension-storage/recovery-files";
import { attachArtifactProjectionRefusals } from "../artifact-projection-admission";
import type { DbOpenPhase } from "../connection.pglite";
import { attachDatabaseAuthority } from "../database-authority";
import type { LegacyConversionFailure } from "../legacy-record-upgrade";
import { observePgliteQueries } from "../query-diagnostics";
import * as schema from "../schemas.pg";
import { retainUnadmittedOwner } from "../storage-admission";
import {
  type DatabaseWorkerMessage,
  type DatabaseWorkerOpenOptions,
  type DatabaseWorkerRequest,
  deserializeDatabaseError,
} from "./protocol";
import { createRemotePglite } from "./remote-pglite";

declare const PSTDIO_BUILD_DATABASE_WORKER: string | undefined;
const CLEANUP_POLL_MS = 100;

// Workers with a statement in flight. Exiting the process then could stop PGlite mid-write.
const openWorkers = new Set<{ busy(): boolean }>();

/** Waits, up to `maxMs`, until no database worker is running a statement. Returns at once in-process. */
export const waitForDatabaseWorkersIdle = async (maxMs: number) => {
  const until = performance.now() + maxMs;
  while ([...openWorkers].some((worker) => worker.busy()) && performance.now() < until) await Bun.sleep(25);
};

// A source run loads the worker beside this module. The compiled binary bundles it as an extra
// entry point and passes its bundled path (see scripts/build/build-compile.ts).
const workerSpecifier = () =>
  typeof PSTDIO_BUILD_DATABASE_WORKER === "string"
    ? PSTDIO_BUILD_DATABASE_WORKER
    : new URL("./worker.ts", import.meta.url).href;

/**
 * Opens the database in its own thread: the lock, migrations, maintenance and every later
 * statement run there. The result has the same shape as `createDb`, so services are unchanged.
 */
export const createDbInWorker = async (
  options: DatabaseWorkerOpenOptions & {
    onPhase?: (phase: DbOpenPhase) => void;
    onLegacyConversionError?: (failure: LegacyConversionFailure) => void;
    signal?: AbortSignal;
    /** The worker stopped without being closed. The database is unusable and its lock is gone. */
    onUnexpectedExit?: (error: Error) => void;
    /** Tests reach the worker through this to simulate a crash. */
    createWorker?: (specifier: string) => Worker;
  } = {},
) => {
  const {
    path: requestedPath,
    indexNodesPath,
    storageRoot,
    deferCleanup,
    onPhase,
    onLegacyConversionError,
    signal,
    onUnexpectedExit,
    createWorker = (specifier) => new Worker(specifier),
  } = options;
  signal?.throwIfAborted();
  const worker = createWorker(workerSpecifier());
  const remote = createRemotePglite(worker);
  const opened = Promise.withResolvers<Extract<DatabaseWorkerMessage, { type: "opened" }>>();
  let exited = false;
  let closeRequested = false;
  let interruption: { reason: unknown } | undefined;
  // Opening counts as busy: startup migrations and maintenance write before the database is ready.
  let opening = true;
  const tracked = { busy: () => opening || remote.busy() };
  openWorkers.add(tracked);

  const interrupt = (reason: unknown) => {
    if (interruption) return;
    interruption = { reason };
    worker.postMessage({ type: "abort" });
  };

  worker.onmessage = (event: MessageEvent<DatabaseWorkerMessage>) => {
    const message = event.data;
    if (remote.receive(message)) return;
    if (message.type === "phase" || message.type === "legacy-conversion-failed") {
      if (interruption) return;
      try {
        if (message.type === "phase") onPhase?.(message.phase);
        else {
          const { owner, backupPath, error } = message;
          onLegacyConversionError?.({ owner, backupPath, error: deserializeDatabaseError(error) });
        }
      } catch (error) {
        interrupt(error);
      }
    } else if (message.type === "opened") opened.resolve(message);
    else if (message.type === "open-failed") opened.reject(deserializeDatabaseError(message.error));
  };
  const stopped = (reason: string) => {
    if (exited) return;
    exited = true;
    openWorkers.delete(tracked);
    const error = new Error(`The database worker stopped: ${reason}`);
    if (opening && !closeRequested) opened.reject(error);
    remote.fail(error);
    if (!closeRequested) onUnexpectedExit?.(error);
  };
  worker.onerror = (event) => stopped(event.message);
  worker.addEventListener("close", () => stopped("it exited"));

  const abort = () => interrupt(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  let ready: Awaited<typeof opened.promise>;
  try {
    worker.postMessage({
      type: "open",
      options: { path: requestedPath, indexNodesPath, storageRoot, deferCleanup },
      reportLegacyConversionErrors: onLegacyConversionError !== undefined,
    } satisfies DatabaseWorkerRequest);
    if (signal?.aborted) abort();
    ready = await opened.promise;
  } catch (error) {
    closeRequested = true;
    openWorkers.delete(tracked);
    if (!exited) worker.terminate();
    throw interruption ? interruption.reason : error;
  } finally {
    opening = false;
    signal?.removeEventListener("abort", abort);
  }

  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= (async () => {
      closeRequested = true;
      try {
        if (!exited) await remote.call({ type: "close" });
      } finally {
        openWorkers.delete(tracked);
        worker.terminate();
      }
    })();
    return closing;
  };

  if (interruption) {
    // Opening completed before the worker could cancel it. Close before rejecting with the original reason.
    await close().catch(() => {});
    throw interruption.reason;
  }

  // Diagnostics channels are per thread, so queries are observed here, where subscribers listen.
  const pglite = observePgliteQueries(remote.pglite as unknown as PGlite);
  const db = drizzle(pglite, { schema });
  const { path, unadmittedOwners, projectionRefusals } = ready;
  // This handle publishes files through the same SQL transaction queue as the worker.
  attachDatabaseAuthority(db, path);
  recoveryFilesFor(db, path);
  documentFilesFor(db, path);
  attachDocumentCollector(db, (projectId, ids) => pruneDocumentFiles(db, projectId, ids));
  for (const { owner, cause } of unadmittedOwners) retainUnadmittedOwner(db, owner, deserializeDatabaseError(cause));
  if (projectionRefusals) attachArtifactProjectionRefusals(db, projectionRefusals);
  // Index nodes are files, so this thread reads the same folder the worker upgraded at startup.
  attachIndexNodeFiles(
    db,
    path === ":memory:" ? createMemoryIndexNodeFiles() : createIndexNodeFiles(indexNodesPath ?? `${path}-index-nodes`),
  );

  return {
    close,
    db,
    path,
    pglite,
    // `stopped` is a synchronous check, so this thread polls it and tells the worker once it turns true.
    cleanupRetiredRows: async (stopped: () => boolean) => {
      if (stopped()) return;
      const poll = setInterval(() => {
        if (!stopped()) return;
        clearInterval(poll);
        worker.postMessage({ type: "stop-cleanup" });
      }, CLEANUP_POLL_MS);
      poll.unref?.();
      try {
        await remote.call({ type: "cleanup" });
      } finally {
        clearInterval(poll);
      }
    },
  };
};
