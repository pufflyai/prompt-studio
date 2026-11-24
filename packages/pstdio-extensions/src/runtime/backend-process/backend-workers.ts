import { isDeepStrictEqual } from "node:util";
import { isMainThread } from "node:worker_threads";
import { createExtensionProcessEnvironment } from "../process-environment";
import { backendWorkerCommand, createBackendWorkerPool } from "./pool";
import { BackendUnavailableError, type BackendWorker, startBackendWorker } from "./supervisor";

type Revision = { entryPath: string; id: string };
type Generation = { key: string; order: number; definition: Promise<unknown>; verified?: BackendWorker };
type Source = { active?: Generation; candidate?: Generation };

const entryOf = (key: string) => key.slice(0, key.lastIndexOf("#"));
const pool = createBackendWorkerPool((key) => ({ env: createExtensionProcessEnvironment(), entryPath: entryOf(key) }));
const sources = new Map<string, Source>();
const reading = new Map<string, Promise<unknown>>();
let updates = Promise.resolve();
let closing: Promise<void> | undefined;
let epoch = 0;
let generationOrder = 0;

const readDefinition = async (revision: Revision) => {
  const worker = await startBackendWorker({
    command: backendWorkerCommand(),
    env: createExtensionProcessEnvironment(),
    entryPath: revision.entryPath,
  });
  try {
    return worker.definition;
  } finally {
    await worker.stop();
  }
};

const readSharedDefinition = (key: string, revision: Revision) => {
  const existing = reading.get(key);
  if (existing) return existing;
  const pending = readDefinition(revision).finally(() => reading.delete(key));
  reading.set(key, pending);
  return pending;
};

const shutDown = () => new BackendUnavailableError("Extension backends were shut down.");
const retired = () => new BackendUnavailableError("This extension backend generation was retired.");

const adopt = (source: Source, generation: Generation, loadedIn: number) => {
  const update = updates.then(async () => {
    if (loadedIn !== epoch || closing) throw shutDown();
    const previous = source.active;
    if (previous === generation) return;
    // Inspecting a candidate does not supersede a published definition, even before its first call.
    if (previous && previous.order > generation.order) throw retired();
    source.active = generation;
    if (previous && ![...sources.values()].some((current) => current.active?.key === previous.key)) {
      await pool.retire(previous.key);
    }
  });
  updates = update.catch(() => {});
  return update;
};

/** Inspect contributions without adopting a candidate or keeping a check-only process alive. */
export const acquireBackendWorker = async (packagePath: string, revision: Revision, definitionOnly = false) => {
  if (definitionOnly || !isMainThread) {
    return {
      definition: await readDefinition(revision),
      acquire: () => Promise.reject(new BackendUnavailableError("Backend handlers are unavailable during inspection.")),
    };
  }
  if (closing) throw shutDown();
  const loadedIn = epoch;
  const key = `${revision.entryPath}#${revision.id}`;
  const source = sources.get(packagePath) ?? {};
  sources.set(packagePath, source);
  const existing = [source.active, source.candidate].find((generation) => generation?.key === key);
  const generation: Generation = existing ?? {
    key,
    order: ++generationOrder,
    definition: readSharedDefinition(key, revision),
  };
  source.candidate = generation;
  let definition: unknown;
  try {
    definition = await generation.definition;
  } catch (error) {
    if (source.candidate === generation) source.candidate = undefined;
    throw error;
  }
  if (loadedIn !== epoch || closing) throw shutDown();

  // The host only invokes handlers from accepted contributions. Until then the previous backend keeps running.
  const acquire = async () => {
    await adopt(source, generation, loadedIn);
    const assertActive = () => {
      if (loadedIn !== epoch || closing) throw shutDown();
      if (source.active !== generation) throw retired();
    };
    assertActive();
    const worker = await pool.acquire(key);
    assertActive();
    if (generation.verified !== worker) {
      if (!isDeepStrictEqual(worker.definition, definition)) {
        throw new BackendUnavailableError("The worker reported a different extension definition.");
      }
      generation.verified = worker;
    }
    return worker;
  };
  return { definition, acquire };
};

export const closeBackendWorkers = () => {
  if (closing) return closing;
  epoch += 1;
  sources.clear();
  closing = updates
    .then(async () => {
      const [stopped] = await Promise.allSettled([pool.close(), ...reading.values()]);
      if (stopped.status === "rejected") throw stopped.reason;
    })
    .finally(() => {
      closing = undefined;
    });
  return closing;
};
