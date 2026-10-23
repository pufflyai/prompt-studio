import { lstat, mkdir, open, readdir, readFile, rename, rm, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const engineIdentity = { format: 1, engine: "pglite-0.4" };
const engineFile = ".pstdio-engine.json";
type Phase =
  | "staging-created"
  | "candidate-verified"
  | "original-moved"
  | "candidate-published"
  | "cleanup-contents-removed"
  | "cleanup-owner-removed"
  | "cleanup-complete";

const exists = async (path: string) => {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};
const flushDirectory = async (path: string) => {
  // Windows does not expose directory fsync through Node. Process-interruption recovery
  // uses the same rename protocol there; power-loss durability is not yet qualified.
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
};
// A marker is either complete or absent. Recovery reads markers to decide what it owns,
// so an interrupted write must never leave a truncated one.
const writeIdentity = async (path: string, value: unknown) => {
  const partial = `${path}.partial`;
  const file = await open(partial, "w");
  try {
    await file.writeFile(JSON.stringify(value));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(partial, path);
  await flushDirectory(dirname(path));
};
const homeState = async (path: string) => {
  if (!(await exists(path))) return "empty" as const;
  if (!(await lstat(path)).isDirectory()) throw new Error(`Expected a database directory: ${path}`);
  const files = await readdir(path);
  if (!files.length) return "empty" as const;
  if (!files.includes(engineFile)) return "legacy" as const;
  const identity = JSON.parse(await readFile(join(path, engineFile), "utf8"));
  if (identity.format !== engineIdentity.format || identity.engine !== engineIdentity.engine) {
    throw new Error(`Unrecognized database engine identity: ${path}`);
  }
  return "current" as const;
};
const removeEmptyHome = async (path: string) => {
  if (await exists(path)) await rmdir(path);
};
const verifiedCandidate = async (path: string) => {
  const identityPath = join(path, engineFile);
  if (!(await exists(identityPath))) return false;
  try {
    const identity = JSON.parse(await readFile(identityPath, "utf8"));
    return identity?.format === engineIdentity.format && identity?.engine === engineIdentity.engine;
  } catch (error) {
    // A private candidate can be rebuilt after interruption while writing its marker.
    // The active-home parser remains strict: it may contain later committed writes.
    if (error instanceof SyntaxError) return false;
    throw error;
  }
};
const readOwner = async (work: string, active: string) => {
  const ownerPath = join(work, "owner.json");
  const unrecognized = `Unrecognized engine transfer directory; preserve it for inspection: ${work}`;
  if (!(await exists(ownerPath))) throw new Error(unrecognized);
  try {
    const owner = JSON.parse(await readFile(ownerPath, "utf8"));
    if (owner?.format !== 1 || owner?.activePath !== active || !["upgrade", "initialize"].includes(owner?.kind)) {
      throw new Error(unrecognized);
    }
    return owner;
  } catch (error) {
    throw new Error(unrecognized, { cause: error });
  }
};

interface Preparation {
  activePath: string;
  signal?: AbortSignal;
  // Resolves only after the private target is verified and its engine is closed.
  // The source remains authoritative; preparation must read an owned copy of it.
  prepare: (paths: { source?: string; target: string; work: string }) => Promise<void>;
  onPhase?: (phase: Phase) => void;
}

// The caller must hold acquirePgliteLock(activePath) throughout preparation and its
// eventual open. The lock lives outside both directories, so rename never releases it.
export const preparePgliteHome = async (options: Preparation) => {
  const active = resolve(options.activePath);
  const work = `${active}.engine-transfer`;
  const target = join(work, "target");
  const original = join(work, "original");
  const onPhase = options.onPhase ?? (() => {});
  let state = await homeState(active);
  const cleanup = async () => {
    // Keep ownership readable until all retained data is gone. A crash after the
    // final unlink leaves only an empty directory, which is safe to remove.
    for (const name of await readdir(work)) {
      if (name !== "owner.json") await rm(join(work, name), { recursive: true });
    }
    await flushDirectory(work);
    onPhase("cleanup-contents-removed");
    await rm(join(work, "owner.json"));
    await flushDirectory(work);
    onPhase("cleanup-owner-removed");
    await rmdir(work);
    await flushDirectory(dirname(work));
    onPhase("cleanup-complete");
  };
  const publish = async (moveOriginal: boolean) => {
    options.signal?.throwIfAborted();
    if (moveOriginal) {
      await rename(active, original);
      await flushDirectory(work);
      await flushDirectory(dirname(active));
      onPhase("original-moved");
    } else {
      await removeEmptyHome(active);
    }
    options.signal?.throwIfAborted();
    await rename(target, active);
    await flushDirectory(work);
    await flushDirectory(dirname(active));
    onPhase("candidate-published");
    await cleanup();
  };
  const recoverOriginal = async () => {
    if (state !== "empty") throw new Error("Ambiguous database homes; preserving active and original directories");
    if (await verifiedCandidate(target)) {
      await publish(false);
      return true;
    }
    await removeEmptyHome(active);
    await rename(original, active);
    await flushDirectory(work);
    await flushDirectory(dirname(active));
    throw new Error("Incomplete engine publication; restored the original database");
  };
  const recover = async () => {
    if (!(await exists(work))) return false;
    const entries = await readdir(work);
    // Nothing is staged until ownership is written, so a start stopped before then left no data.
    if (!entries.length || (entries.length === 1 && entries[0] === "owner.json.partial")) {
      await rm(work, { recursive: true });
      return false;
    }
    const owner = await readOwner(work, active);
    if (state === "current") {
      await cleanup();
      return true;
    }
    if (await exists(original)) return recoverOriginal();
    if (state === "empty" && owner.kind === "upgrade") {
      throw new Error("Missing original database; refusing to promote a prepared copy");
    }
    if (state === "empty" && (await verifiedCandidate(target))) {
      await publish(false);
      return true;
    }
    await cleanup();
    return false;
  };
  if (await recover()) return;
  state = await homeState(active);
  if (state === "current") return;
  await mkdir(work);
  await writeIdentity(join(work, "owner.json"), {
    format: 1,
    activePath: active,
    kind: state === "legacy" ? "upgrade" : "initialize",
  });
  await flushDirectory(dirname(work));
  onPhase("staging-created");
  await options.prepare({ source: state === "legacy" ? active : undefined, target, work });
  options.signal?.throwIfAborted();
  if ((await homeState(target)) !== "legacy") throw new Error("Preparation must produce an unmarked nonempty database");
  await writeIdentity(join(target, engineFile), engineIdentity);
  onPhase("candidate-verified");
  await publish(state === "legacy");
};
