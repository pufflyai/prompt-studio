import { lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";

const folder = (id: string) => join(resolvePstdioHome(), "projects", `project-${encodeURIComponent(id)}`);
const marker = (id: string) =>
  join(resolvePstdioHome(), "project-folder-ownership", `project-${encodeURIComponent(id)}`);

const missing = (error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") return null;
  throw error;
};

const identity = async (path: string) => {
  const stat = await lstat(path, { bigint: true }).catch(missing);
  return stat?.isDirectory() ? `${stat.dev}:${stat.ino}` : null;
};

export const prepareManagedProjectFolder = async (id: string) => {
  const path = folder(id);
  if (await mkdir(path, { recursive: true })) {
    const owned = await identity(path);
    if (!owned) throw new Error("The managed project directory changed during setup.");
    const record = marker(id);
    await mkdir(dirname(record), { recursive: true, mode: 0o700 });
    await writeFile(record, owned, { mode: 0o600 });
  }
  return realpath(path);
};

export const inspectManagedProjectFolder = async (id: string, root: string | null | undefined) => {
  const path = folder(id);
  if (!root || root !== (await realpath(path).catch(missing))) return { removesManagedFolder: false };
  const found = await identity(path);
  if (!found) return { removesManagedFolder: false };
  const recorded = await readFile(marker(id), "utf8").catch(missing);
  if (recorded === found) return { removesManagedFolder: true };
  return { removesManagedFolder: false, retainsUnverifiedFolder: true as const };
};

export const removeManagedProjectFolder = async (id: string, root: string | null | undefined) => {
  if ((await inspectManagedProjectFolder(id, root)).removesManagedFolder)
    await rm(folder(id), { recursive: true, force: true });
  await rm(marker(id), { force: true });
};
