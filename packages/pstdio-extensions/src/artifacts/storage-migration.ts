import type { Stats } from "node:fs";
import { lstat, mkdir, readdir, readFile, readlink, rename, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  ARTIFACT_MOUNT_ROOT,
  type ExtensionStorageOwner,
  extensionStorageDirectory,
  isWindowsDeviceName,
} from "./extension-storage-path";
import { discoverExtensionStorageOwners } from "./storage-owners";

export { extensionStorageDirectory } from "./extension-storage-path";

const migrations = new Map<string, { owners: string; run: Promise<void> }>();
const exists = async (path: string) => {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
const alias = async (path: string, target: string) => {
  if (process.platform === "win32" && isWindowsDeviceName(path.split(/[/\\]/).at(-1)!)) return;
  if (await exists(path)) return;
  await mkdir(resolve(path, ".."), { recursive: true });
  const destination = process.platform === "win32" ? resolve(target) : relative(dirname(path), target);
  await symlink(destination, path, process.platform === "win32" ? "junction" : "dir");
};
const moveFiles = async (from: string, to: string) => {
  if (!(await exists(from))) return;
  for (const entry of await readdir(from)) {
    const destination = join(to, entry);
    if (await exists(destination))
      throw new Error(`Extension storage migration needs a file conflict resolved: ${destination}`);
    await rename(join(from, entry), destination);
  }
};
const groupOwners = (owners: readonly ExtensionStorageOwner[]) => {
  const names = new Map<string, ExtensionStorageOwner[]>();
  for (const owner of owners) {
    extensionStorageDirectory(owner.extensionId);
    const name = owner.extensionId.split(".")[1]!;
    const sameName = names.get(name) ?? [];
    if (!sameName.some((entry) => entry.extensionId === owner.extensionId)) sameName.push(owner);
    names.set(name, sameName);
  }
  return names;
};
const migratePrivateFiles = async (from: string, to: string) => {
  const previous = await exists(from);
  if (previous && !previous.isSymbolicLink()) {
    await moveFiles(from, to);
    await rmdir(from);
  }
  await alias(from, to);
};
const migrateOwner = async (
  root: string,
  old: string,
  previous: Stats | null,
  shared: boolean,
  owner: ExtensionStorageOwner,
) => {
  const next = join(root, extensionStorageDirectory(owner.extensionId));
  const legacyDirectory = previous?.isDirectory();
  if (!shared && legacyDirectory && !(await exists(next))) await rename(old, next);
  await mkdir(next, { recursive: true });
  if (!shared && legacyDirectory && (await exists(old))) {
    throw new Error(`Both legacy and full-ID extension storage exist: ${old}`);
  }
  const publisher = owner.extensionId.split(".")[0];
  if (shared && legacyDirectory) await migratePrivateFiles(join(old, ".publishers", publisher), next);
  await migratePrivateFiles(join(next, ".publishers", publisher), next);
  if (shared) return;
  if (previous?.isSymbolicLink() && resolve(dirname(old), await readlink(old)) !== resolve(next)) await unlink(old);
  await alias(old, next);
};
const updateIgnore = async (repoRoot: string, owners: readonly ExtensionStorageOwner[]) => {
  if (!owners.length) return;
  const ignorePath = join(repoRoot, ".pstdio/.gitignore");
  const existing = (await exists(ignorePath)) ? await readFile(ignorePath, "utf8") : "";
  const rules = new Set(existing.split("\n").filter(Boolean));
  for (const owner of owners) {
    const [publisher, name] = owner.extensionId.split(".") as [string, string];
    const directory = `/extension-storage/${extensionStorageDirectory(owner.extensionId)}/`;
    rules.add(`/extension-storage/${name}`);
    rules.add(`${directory}.publishers/`);
    if (rules.has(`/extension-storage/${name}/`)) rules.add(directory);
    // Private files moved from the publisher folder into the full-ID folder keep their
    // exclusion, in the owned form that ctx.extensionFiles maintains.
    if (rules.has(`/extension-storage/${name}/.publishers/${publisher}/`) && !rules.has(directory)) {
      rules.add(`# pstdio:ignore-owned ${directory}`);
      rules.add(directory);
    }
  }
  const next = `${[...rules].join("\n")}\n`;
  if (next !== existing) await writeFile(ignorePath, next);
};
const migrate = async (repoRoot: string, owners: readonly ExtensionStorageOwner[]) => {
  if (!(await exists(repoRoot))) return;
  owners = await discoverExtensionStorageOwners(repoRoot, owners);
  const root = join(repoRoot, ARTIFACT_MOUNT_ROOT);
  for (const [name, group] of groupOwners(owners)) {
    const old = join(root, name);
    const previous = await exists(old);
    const shared = group.length > 1;
    if (shared && previous?.isSymbolicLink()) await unlink(old);
    for (const owner of group) await migrateOwner(root, old, previous, shared, owner);
  }
  await updateIgnore(repoRoot, owners);
};

export const migrateExtensionStorage = async (repoRoot: string, owners: readonly ExtensionStorageOwner[]) => {
  const key = resolve(repoRoot);
  const ownerKey = [...new Set(owners.map((owner) => owner.extensionId))].sort().join("\n");
  const previous = migrations.get(key);
  if (previous?.owners === ownerKey) return previous.run;
  const run = (previous?.run ?? Promise.resolve()).catch(() => undefined).then(() => migrate(key, owners));
  migrations.set(key, { owners: ownerKey, run });
  try {
    await run;
  } catch (error) {
    if (migrations.get(key)?.run === run) migrations.delete(key);
    throw error;
  }
};
