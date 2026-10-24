import { lstat, mkdir, open, readdir, readFile, rename, rm, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { renamePgliteHome } from "./rename-pglite-home";

// The baseline names the schema generation. A home written by any other release is
// retired instead of upgraded, so no code has to understand older databases.
export const engineIdentity = { format: 1, engine: "pglite-0.4", baseline: "0.46" };
export const engineFile = ".pstdio-engine.json";
type Phase =
  | "home-retired"
  | "staging-created"
  | "candidate-verified"
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
const hasCurrentIdentity = async (home: string) => {
  const path = join(home, engineFile);
  if (!(await exists(path))) return false;
  try {
    const identity = JSON.parse(await readFile(path, "utf8"));
    return (
      identity?.format === engineIdentity.format &&
      identity?.engine === engineIdentity.engine &&
      identity?.baseline === engineIdentity.baseline
    );
  } catch (error) {
    // A truncated marker never names the current baseline; its home is retired, not read.
    if (error instanceof SyntaxError) return false;
    throw error;
  }
};
const homeState = async (path: string) => {
  if (!(await exists(path))) return "empty" as const;
  if (!(await lstat(path)).isDirectory()) throw new Error(`Expected a database directory: ${path}`);
  if (!(await readdir(path)).length) return "empty" as const;
  return (await hasCurrentIdentity(path)) ? ("current" as const) : ("retired" as const);
};
const readOwner = async (work: string, active: string) => {
  const ownerPath = join(work, "owner.json");
  const unrecognized = `Unrecognized database staging directory; preserve it for inspection: ${work}`;
  if (!(await exists(ownerPath))) throw new Error(unrecognized);
  let owner: { format?: unknown; activePath?: unknown } | undefined;
  try {
    owner = JSON.parse(await readFile(ownerPath, "utf8"));
  } catch (error) {
    throw new Error(unrecognized, { cause: error });
  }
  if (owner?.format !== 1 || owner?.activePath !== active) throw new Error(unrecognized);
};

interface Preparation {
  activePath: string;
  signal?: AbortSignal;
  /** Moves a home written by another release out of activePath without losing its data. */
  retire: (active: string) => Promise<void>;
  // Resolves after the private image is complete and any preparation engine is closed.
  prepare: (paths: { target: string }) => Promise<void>;
  onPhase?: (phase: Phase) => void;
}

// The caller must hold acquirePgliteLock(activePath) throughout preparation and its
// eventual open. The lock lives outside both directories, so rename never releases it.
export const preparePgliteHome = async (options: Preparation) => {
  const active = resolve(options.activePath);
  const work = `${active}.staging`;
  const target = join(work, "target");
  const onPhase = options.onPhase ?? (() => {});
  const cleanup = async () => {
    // Keep ownership readable until all staged data is gone. A crash after the
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
  const publish = async () => {
    options.signal?.throwIfAborted();
    if (await exists(active)) await rmdir(active);
    await renamePgliteHome(target, active, options.signal);
    await flushDirectory(work);
    await flushDirectory(dirname(active));
    onPhase("candidate-published");
    await cleanup();
  };
  // Staging only ever holds a new empty database, so it is published into an empty home
  // and discarded otherwise. It never replaces data.
  const recover = async () => {
    if (!(await exists(work))) return;
    const entries = await readdir(work);
    // Nothing is staged until ownership is written, so a start stopped before then left no data.
    if (!entries.length || (entries.length === 1 && entries[0] === "owner.json.partial")) {
      await rm(work, { recursive: true });
      return;
    }
    await readOwner(work, active);
    if ((await homeState(active)) === "empty" && (await hasCurrentIdentity(target))) return publish();
    await cleanup();
  };

  await recover();
  let state = await homeState(active);
  if (state === "current") return;
  if (state === "retired") {
    await options.retire(active);
    state = await homeState(active);
    if (state !== "empty") throw new Error(`Retiring the database left data at ${active}`);
    onPhase("home-retired");
  }
  await mkdir(work);
  await writeIdentity(join(work, "owner.json"), { format: 1, activePath: active });
  await flushDirectory(dirname(work));
  onPhase("staging-created");
  await options.prepare({ target });
  options.signal?.throwIfAborted();
  if ((await homeState(target)) !== "retired")
    throw new Error("Preparation must produce an unmarked nonempty database");
  await writeIdentity(join(target, engineFile), engineIdentity);
  onPhase("candidate-verified");
  await publish();
};
