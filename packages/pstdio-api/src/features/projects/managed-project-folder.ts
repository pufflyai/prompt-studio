import { lstat, mkdir, readFile, realpath, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { z } from "zod";
import { acquireRecoveryJournalLease } from "../../services/project-recovery/journal";
import {
  discardFolderCreation,
  hasPendingFolderCreation,
  managedDirectoryIdentity as identity,
  prepareFolderCreation,
  readCreationIdentity,
} from "./managed-folder-creation";

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

export const prepareManagedProjectFolder = (id: string) =>
  withManagedFolderLease(id, async () => {
    if (await lstat(`${marker(id)}.removal`).catch(missing))
      throw new Error("Managed folder cleanup is incomplete. Retry removing the project copy first.");
    return prepareFolderCreation(folder(id), marker(id));
  });

const inspectOwnership = async (id: string, root: string | null | undefined) => {
  const path = folder(id);
  const matchesRoot = !root || root === (await realpath(path).catch(missing));
  const found = await identity(path);
  if (!found) return { identity: null };
  const recorded = await readFile(marker(id), "utf8").catch(missing);
  // An unfinished creation receipt proves this private app-owned object even if
  // the user subsequently selected a different workspace folder.
  if ((matchesRoot && recorded === found) || (await readCreationIdentity(marker(id))) === found)
    return { identity: found };
  return { identity: null, ...(matchesRoot ? { retainsUnverifiedFolder: true as const } : {}) };
};

export const inspectManagedProjectFolder = async (id: string, root: string | null | undefined) => {
  if (!root) return { removesManagedFolder: false };
  const proof = await inspectOwnership(id, root);
  if (proof.identity) return { removesManagedFolder: true };
  return {
    removesManagedFolder: false,
    ...("retainsUnverifiedFolder" in proof && proof.retainsUnverifiedFolder
      ? { retainsUnverifiedFolder: true as const }
      : {}),
  };
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

const requireCompletedCreation = async (
  id: string,
  root: string | null | undefined,
  proof: Awaited<ReturnType<typeof inspectOwnership>>,
) => {
  const pending = await hasPendingFolderCreation(marker(id));
  if (root && pending && !proof.identity) {
    // Before anything is deleted, reclaim only an empty private reservation.
    // Nonempty or replaced stages retain their receipt and report their path.
    await discardFolderCreation(folder(id), marker(id));
    return;
  }
  if (!root && (proof.identity || pending))
    throw new Error("Managed folder setup is incomplete. Retry opening the project before removing this copy.");
};

// Check before eviction deletes provider resources, content or secrets. Removal
// repeats the proof under its own lease before claiming the filesystem object.
export const assertManagedFolderCleanupReady = (id: string, root: string | null | undefined) =>
  withManagedFolderLease(id, async () => {
    const saved = await readFile(`${marker(id)}.removal`, "utf8").catch(missing);
    if (saved) {
      removalSchema.parse(JSON.parse(saved));
      return;
    }
    await requireCompletedCreation(id, root, await inspectOwnership(id, root));
  });

export const removeManagedProjectFolder = (id: string, root: string | null | undefined) =>
  withManagedFolderLease(id, async () => {
    const path = folder(id);
    const record = marker(id);
    const journal = `${record}.removal`;
    const saved = await readFile(journal, "utf8").catch(missing);
    let removal = saved ? removalSchema.parse(JSON.parse(saved)) : null;
    if (!removal) {
      const proof = await inspectOwnership(id, root);
      await requireCompletedCreation(id, root, proof);
      if (!proof.identity) {
        await discardFolderCreation(path, record);
        await rm(record, { force: true });
        return;
      }
      removal = removalSchema.parse({
        identity: proof.identity,
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
    await discardFolderCreation(path, record);
    await rm(record, { force: true });
    await rm(journal, { force: true });
  });
