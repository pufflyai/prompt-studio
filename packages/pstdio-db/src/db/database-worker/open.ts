import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  attachIndexNodeFiles,
  createIndexNodeFiles,
  createMemoryIndexNodeFiles,
} from "../../services/extension-storage/index-node-files";
import type { DbOpenPhase } from "../connection.pglite";
import { observePgliteQueries } from "../query-diagnostics";
import * as schema from "../schemas.pg";
import { type DatabaseWorkerMessage, type DatabaseWorkerOpenOptions, deserializeDatabaseError } from "./protocol";
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
    signal?: AbortSignal;
    /** The worker stopped without being closed. The database is unusable and its lock is gone. */
    onUnexpectedExit?: (error: Error) => void;
    /** Tests reach the worker through this to simulate a crash. */
    createWorker?: (specifier: string) => Worker;
  } = {},
) => {
  const { onPhase, signal, onUnexpectedExit, createWorker = (specifier) => new Worker(specifier), ...open } = options;
  signal?.throwIfAborted();
  const worker = createWorker(workerSpecifier());
  const remote = createRemotePglite(worker);
  const opened = Promise.withResolvers<string>();
  let exited = false;
  let closeRequested = false;

  worker.onmessage = (event: MessageEvent<DatabaseWorkerMessage>) => {
    const message = event.data;
    if (remote.receive(message)) return;
    if (message.type === "phase") onPhase?.(message.phase);
    else if (message.type === "opened") opened.resolve(message.path);
    else if (message.type === "open-failed") opened.reject(deserializeDatabaseError(message.error));
  };
  const stopped = (reason: string) => {
    if (exited) return;
    exited = true;
    openWorkers.delete(remote);
    const error = new Error(`The database worker stopped: ${reason}`);
    opened.reject(error);
    remote.fail(error);
    if (!closeRequested) onUnexpectedExit?.(error);
  };
  worker.onerror = (event) => stopped(event.message);
  worker.addEventListener("close", () => stopped("it exited"));

  const abort = () => worker.postMessage({ type: "abort" });
  signal?.addEventListener("abort", abort, { once: true });
  worker.postMessage({ type: "open", options: open });
  let path: string;
  try {
    path = await opened.promise;
  } catch (error) {
    closeRequested = true;
    if (!exited) worker.terminate();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  openWorkers.add(remote);
  // Diagnostics channels are per thread, so queries are observed here, where subscribers listen.
  const pglite = observePgliteQueries(remote.pglite as unknown as PGlite);
  const db = drizzle(pglite, { schema });
  // Index nodes are files, so this thread reads the same folder the worker upgraded at startup.
  attachIndexNodeFiles(
    db,
    path === ":memory:"
      ? createMemoryIndexNodeFiles()
      : createIndexNodeFiles(open.indexNodesPath ?? `${path}-index-nodes`),
  );

  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= (async () => {
      closeRequested = true;
      try {
        if (!exited) await remote.call({ type: "close" });
      } finally {
        openWorkers.delete(remote);
        worker.terminate();
      }
    })();
    return closing;
  };

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
