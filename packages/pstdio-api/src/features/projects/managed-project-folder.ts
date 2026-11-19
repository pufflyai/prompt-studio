import { lstat, mkdir, readFile, realpath, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { z } from "zod";
import { acquireRecoveryJournalLease } from "../../services/project-recovery/journal";

const folder = (id: string) => join(resolvePstdioHome(), "projects", `project-${encodeURIComponent(id)}`);
const marker = (id: string) =>
  join(resolvePstdioHome(), "project-folder-ownership", `project-${encodeURIComponent(id)}`);

const withManagedFolderLease = async <T>(id: string, action: () => Promise<T>) => {
  const record = marker(id);
  await mkdir(dirname(record), { recursive: true, mode: 0o700 });
  const release = acquireRecoveryJournalLease(`${record}.removal.sqlite`);
  if (!release) throw new Error("Another Prompt Studio process owns this managed folder. Retry cleanup later.");
  try {
    return await action();
  } finally {
    release();
  }
};

const missing = (error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") return null;
  throw error;
};

const identity = async (path: string) => {
  const stat = await lstat(path, { bigint: true }).catch(missing);
  return stat?.isDirectory() ? `${stat.dev}:${stat.ino}` : null;
};

export const prepareManagedProjectFolder = (id: string) =>
  withManagedFolderLease(id, async () => {
    if (await lstat(`${marker(id)}.removal`).catch(missing))
      throw new Error("Managed folder cleanup is incomplete. Retry removing the project copy first.");
    const path = folder(id);
    if (await mkdir(path, { recursive: true })) {
      const owned = await identity(path);
      if (!owned) throw new Error("The managed project directory changed during setup.");
      try {
        const record = marker(id);
        await mkdir(dirname(record), { recursive: true, mode: 0o700 });
        await writeFile(record, owned, { mode: 0o600 });
      } catch (error) {
        if ((await identity(path).catch(() => null)) === owned) await rmdir(path).catch(() => {});
        throw error;
      }
    }
    return realpath(path);
  });

export const inspectManagedProjectFolder = async (id: string, root: string | null | undefined) => {
  const path = folder(id);
  if (!root || root !== (await realpath(path).catch(missing))) return { removesManagedFolder: false };
  const found = await identity(path);
  if (!found) return { removesManagedFolder: false };
  const recorded = await readFile(marker(id), "utf8").catch(missing);
  if (recorded === found) return { removesManagedFolder: true };
  return { removesManagedFolder: false, retainsUnverifiedFolder: true as const };
};

const removalSchema = z.strictObject({
  identity: z.string().regex(/^\d+:\d+$/),
  directory: z.string().uuid(),
  claimed: z.boolean(),
});
const saveRemoval = async (path: string, value: z.infer<typeof removalSchema>) => {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};

const claimManagedFolder = async (
  path: string,
  claimed: string,
  journal: string,
  removal: z.infer<typeof removalSchema>,
) => {
  const retained = (location: string) =>
    new Error(`The managed folder changed during cleanup. Files were retained at ${location}`);
  if (!(await lstat(claimed).catch(missing)) && !removal.claimed) {
    if ((await identity(path)) !== removal.identity) throw retained(path);
    await rename(path, claimed);
  }
  const found = await lstat(claimed, { bigint: true }).catch(missing);
  if (found && (!found.isDirectory() || `${found.dev}:${found.ino}` !== removal.identity)) throw retained(claimed);
  if (!found && !removal.claimed) throw retained(claimed);
  if (!removal.claimed) {
    removal.claimed = true;
    await saveRemoval(journal, removal);
  }
};

export const removeManagedProjectFolder = (id: string, root: string | null | undefined) =>
  withManagedFolderLease(id, async () => {
    const path = folder(id);
    const record = marker(id);
    const journal = `${record}.removal`;
    const saved = await readFile(journal, "utf8").catch(missing);
    let removal = saved ? removalSchema.parse(JSON.parse(saved)) : null;
    if (!removal) {
      if (!(await inspectManagedProjectFolder(id, root)).removesManagedFolder) {
        await rm(record, { force: true });
        return;
      }
      removal = removalSchema.parse({
        identity: await readFile(record, "utf8"),
        directory: crypto.randomUUID(),
        claimed: false,
      });
    }
    const directory = join(dirname(path), `.project-removal-${removal.directory}`);
    const claimed = join(directory, "folder");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    // Persist the claim before moving the shared pathname; a later cleanup resumes this same object.
    try {
      await saveRemoval(journal, removal);
    } catch (error) {
      await rmdir(directory).catch(() => {});
      throw error;
    }
    await claimManagedFolder(path, claimed, journal, removal);
    // Only this verified object in the private claim directory can be removed recursively.
    await rm(claimed, { recursive: true, force: true });
    await rmdir(directory).catch(missing);
    await rm(record, { force: true });
    await rm(journal, { force: true });
  });
