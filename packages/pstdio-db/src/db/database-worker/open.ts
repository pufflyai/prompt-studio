import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  attachIndexNodeFiles,
  createIndexNodeFiles,
  createMemoryIndexNodeFiles,
} from "../../services/extension-storage/index-node-files";
import type { DbOpenPhase } from "../connection.pglite";
import * as schema from "../schemas.pg";
import { type DatabaseWorkerMessage, type DatabaseWorkerOpenOptions, deserializeDatabaseError } from "./protocol";
import { createRemotePglite } from "./remote-pglite";

declare const PSTDIO_BUILD_DATABASE_WORKER: string | undefined;

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
  options: DatabaseWorkerOpenOptions & { onPhase?: (phase: DbOpenPhase) => void; signal?: AbortSignal } = {},
) => {
  const { onPhase, signal, ...open } = options;
  signal?.throwIfAborted();
  const worker = new Worker(workerSpecifier());
  const remote = createRemotePglite(worker);
  const opened = Promise.withResolvers<string>();
  let exited = false;

  worker.onmessage = (event: MessageEvent<DatabaseWorkerMessage>) => {
    const message = event.data;
    if (remote.receive(message)) return;
    if (message.type === "phase") onPhase?.(message.phase);
    else if (message.type === "opened") opened.resolve(message.path);
    else if (message.type === "open-failed") opened.reject(deserializeDatabaseError(message.error));
  };
  const stopped = (reason: string) => {
    exited = true;
    const error = new Error(`The database worker stopped: ${reason}`);
    opened.reject(error);
    remote.fail(error);
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
    if (!exited) worker.terminate();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  const pglite = remote.pglite as unknown as PGlite;
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
      try {
        if (!exited) await remote.call({ type: "close" });
      } finally {
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
    cleanupRetiredRows: async () => {
      await remote.call({ type: "cleanup" });
    },
  };
};
