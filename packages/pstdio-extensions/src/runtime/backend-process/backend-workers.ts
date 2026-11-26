import { isMainThread } from "node:worker_threads";
import { finishRuntimeOperation, startRuntimeOperation } from "pstdio-diagnostics";
import { readAcceptedRevision } from "../prepared-revision";
import { createBackendWorkerEnvironment } from "../process-environment";
import {
  type DefinitionRevision,
  definitionDigest,
  forgetCachedDefinition,
  readCachedDefinition,
  writeCachedDefinition,
} from "./definition-cache";
import { backendWorkerCommand, createBackendWorkerPool } from "./pool";
import { BackendUnavailableError } from "./protocol";
import { type BackendWorker, startBackendWorker } from "./supervisor";

type Revision = DefinitionRevision & { manifest: { id: string } };
type Generation = { key: string; digest: string; order: number; workerKey: string };
type Source = { active?: Generation; candidate?: Generation; updating?: Promise<void> };

const keyOf = (revision: DefinitionRevision) => `${revision.entryPath}#${revision.id}`;
const entryOf = (key: string) => key.slice(0, key.lastIndexOf("#"));
const pool = createBackendWorkerPool((key) => ({ env: createBackendWorkerEnvironment(), entryPath: entryOf(key) }));
const sources = new Map<string, Source>();
let updates = Promise.resolve();
let closing: Promise<void> | undefined;
let epoch = 0;
let generationOrder = 0;

// Loads of the same revision that miss the cache together share one reading worker.
const reading = new Map<string, Promise<unknown>>();
const digests = new WeakMap<BackendWorker, string>();
let definitionReads = 0;

/** How many times a worker evaluated an entry only to report its definition. */
export const readBackendDefinitionReadCount = () => definitionReads;

const shutDown = () => new BackendUnavailableError("Extension backends were shut down.");
const retired = () => new BackendUnavailableError("This extension backend generation was retired.");

const assertOpen = (loadedIn: number) => {
  if (loadedIn !== epoch || closing) throw shutDown();
};

const updateSource = (source: Source, work: () => Promise<void>) => {
  const update = updates.then(work).finally(() => {
    if (source.updating === update) source.updating = undefined;
  });
  source.updating = update;
  updates = update.catch(() => {});
  return update;
};

const sameDefinition = (a: Generation | undefined, b: Pick<Generation, "key" | "digest">) =>
  a?.key === b.key && a.digest === b.digest;

const workerIsShared = (source: Source, workerKey: string) =>
  [...sources.values()].some((other) => other !== source && other.active?.workerKey === workerKey);

const adoptGeneration = async (
  source: Source,
  generation: Generation,
  loadedIn: number,
  isRestored: () => Promise<boolean>,
) => {
  if (!source.updating && sameDefinition(source.active, generation)) return;
  await updateSource(source, async () => {
    assertOpen(loadedIn);
    const previous = source.active;
    if (sameDefinition(previous, generation)) return;
    // A candidate cannot replace the active worker until the host uses its handler.
    if (previous && previous.order > generation.order) {
      if (previous.key === generation.key || !(await isRestored())) throw retired();
      assertOpen(loadedIn);
      generation.order = ++generationOrder;
    }
    if (previous && previous.workerKey !== generation.workerKey && !workerIsShared(source, previous.workerKey)) {
      await pool.retire(previous.workerKey);
      assertOpen(loadedIn);
    }
    source.active = generation;
  });
};

/** Evaluates the entry in a short-lived worker that stops as soon as it has reported its definition. */
const readDefinition = async (revision: Revision) => {
  const started = startRuntimeOperation("extension.backend.definition", { extensionId: revision.manifest.id });
  definitionReads += 1;
  let failed = true;
  try {
    const worker = await startBackendWorker({
      command: backendWorkerCommand(),
      env: createBackendWorkerEnvironment(),
      entryPath: revision.entryPath,
    });
    await worker.stop();
    writeCachedDefinition(revision, worker.definition);
    failed = false;
    return worker.definition;
  } finally {
    finishRuntimeOperation(started, { failed });
  }
};

const cachedOrRead = (revision: Revision) => {
  const cached = readCachedDefinition(revision);
  if (cached) return Promise.resolve(cached.definition);
  const pending = reading.get(revision.id);
  if (pending) return pending;
  const read = readDefinition(revision).finally(() => reading.delete(revision.id));
  reading.set(revision.id, read);
  return read;
};

const acquireMatching = async (source: Source, generation: Generation, revision: Revision, loadedIn: number) => {
  const { workerKey, digest } = generation;
  const assertActive = () => {
    assertOpen(loadedIn);
    if (!sameDefinition(source.active, generation) || source.active?.workerKey !== workerKey) throw retired();
  };
  assertActive();
  const worker = await pool.acquire(workerKey);
  assertActive();
  let reported = digests.get(worker);
  if (reported === undefined) {
    reported = definitionDigest(worker.definition);
    digests.set(worker, reported);
  }
  if (reported === digest) return worker;
  // The entry reports a different definition each time it loads. The next load reads it again.
  forgetCachedDefinition(revision.id);
  await pool.retire(workerKey);
  throw new BackendUnavailableError(
    "The extension reported a different definition than when it was loaded. Reload the extension.",
  );
};

/**
 * Returns the definition a source generation reports and a way to reach its worker. The
 * definition comes from the revision's cache when it can be trusted, so no worker starts until
 * a handler runs. Every call asks the pool again, so a worker that crashed is replaced by the next
 * call, never by a restart loop.
 */
export const loadBackendDefinition = async (packagePath: string, revision: Revision, definitionOnly = false) => {
  // Source checks run in preparation threads. They only need the reported data.
  if (definitionOnly || !isMainThread)
    return {
      definition: await cachedOrRead(revision),
      acquire: () => Promise.reject(new BackendUnavailableError("Backend handlers are unavailable during inspection.")),
    };
  const loadedIn = epoch;
  assertOpen(loadedIn);
  const key = keyOf(revision);
  const order = ++generationOrder;
  const source = sources.get(packagePath) ?? {};
  sources.set(packagePath, source);
  const definition = await cachedOrRead(revision);
  assertOpen(loadedIn);
  const digest = definitionDigest(definition);
  const existing = [source.active, source.candidate].find((known) => sameDefinition(known, { key, digest }));
  const generation = existing ?? { key, digest, order, workerKey: key };
  if (!source.candidate || source.candidate.order < generation.order) source.candidate = generation;
  const acquire = async () => {
    await adoptGeneration(source, generation, loadedIn, async () => {
      return (await readAcceptedRevision(packagePath))?.id === revision.id;
    });
    return acquireMatching(source, generation, revision, loadedIn);
  };
  return { definition, acquire };
};

/** Start the committed backend without switching the previous worker away from its calls. */
export const primeAcceptedExtensionBackend = async (packagePath: string, revision: Revision) => {
  if (!isMainThread || closing) return;
  const loadedIn = epoch;
  if ((await readAcceptedRevision(packagePath))?.id !== revision.id) return;
  assertOpen(loadedIn);
  await pool.acquire(keyOf(revision));
};

/** Give a reloaded folder fresh worker state for its unchanged active generation. */
export const restartBackendWorker = async (packagePath: string, revision: DefinitionRevision) => {
  const source = sources.get(packagePath);
  if (!source) return;
  await updateSource(source, async () => {
    const active = source.active;
    if (!active || active.key !== keyOf(revision)) return;
    if (workerIsShared(source, active.workerKey)) {
      // Other folders still need the shared worker. Start a separate one for this folder on demand.
      active.workerKey = `${active.key}.${++generationOrder}`;
      return;
    }
    await pool.retire(active.workerKey);
  });
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
