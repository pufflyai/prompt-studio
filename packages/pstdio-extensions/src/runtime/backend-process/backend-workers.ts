import { isMainThread } from "node:worker_threads";
import { createExtensionProcessEnvironment } from "../process-environment";
import { backendWorkerCommand, createBackendWorkerPool } from "./pool";
import { startBackendWorker } from "./supervisor";

const entryOf = (key: string) => key.slice(0, key.lastIndexOf("#"));
const pool = createBackendWorkerPool((key) => ({ env: createExtensionProcessEnvironment(), entryPath: entryOf(key) }));
// Folders with identical content share one generation, so a worker retires only when no folder uses it.
const generations = new Map<string, string>();
let updates = Promise.resolve();

const retireUnused = async (key: string) => {
  if (![...generations.values()].includes(key)) await pool.retire(key);
};

/**
 * Returns the definition a source generation reports and a way to reach its worker. Every call
 * asks the pool again, so a worker that crashed is replaced by the next call, never by a restart loop.
 */
export const acquireBackendWorker = async (packagePath: string, revision: { entryPath: string; id: string }) => {
  const key = `${revision.entryPath}#${revision.id}`;
  // Source checks run in preparation threads. They only need the reported data, so their worker stops at once.
  if (!isMainThread) {
    const worker = await startBackendWorker({
      command: backendWorkerCommand(),
      env: createExtensionProcessEnvironment(),
      entryPath: revision.entryPath,
    });
    await worker.stop();
    return { definition: worker.definition, acquire: () => Promise.reject(new Error("Not available while checking.")) };
  }
  const update = updates.then(async () => {
    const previous = generations.get(packagePath);
    generations.set(packagePath, key);
    if (previous && previous !== key) await retireUnused(previous);
  });
  updates = update.catch(() => {});
  await update;
  const worker = await pool.acquire(key);
  return { definition: worker.definition, acquire: () => pool.acquire(key) };
};

export const closeBackendWorkers = () => {
  generations.clear();
  return pool.close();
};
