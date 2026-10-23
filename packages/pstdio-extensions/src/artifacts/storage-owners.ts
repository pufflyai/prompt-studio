import { lstat, readdir } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { ARTIFACT_MOUNT_ROOT, type ExtensionStorageOwner, extensionStorageDirectory } from "./extension-storage-path";
import { createLegacyExtensionPathResolver } from "./legacy-extension-paths";

export const storagePathExists = async (path: string) => {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};
const entries = async (path: string) => {
  try {
    return await readdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};
const ownerFor = (id: string) =>
  /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(id) ? { extensionId: id, name: id.split(".")[1]! } : null;

// Persisted folders also own data when an extension is disabled or has been uninstalled.
export const discoverExtensionStorageOwners = async (repoRoot: string, declared: readonly ExtensionStorageOwner[]) => {
  const root = join(repoRoot, ARTIFACT_MOUNT_ROOT);
  const owners = new Map(declared.map((owner) => [owner.extensionId, owner]));
  for (const entry of await entries(root)) {
    const id = entry.startsWith("_") ? entry.slice(1) : entry;
    const owner = ownerFor(id);
    if (owner && extensionStorageDirectory(id) === entry) owners.set(id, owner);
  }
  for (const name of new Set([...owners.values()].map((owner) => owner.name))) {
    for (const publisher of await entries(join(root, name, ".publishers"))) {
      const owner = ownerFor(`${publisher}.${name}`);
      if (owner) owners.set(owner.extensionId, owner);
    }
  }
  return [...owners.values()];
};

export const resolveReadExtensionStorageRoot = async (
  repoRoot: string,
  owner: ExtensionStorageOwner,
  privateFiles: boolean,
) => {
  const canonical = join(repoRoot, ARTIFACT_MOUNT_ROOT, extensionStorageDirectory(owner.extensionId));
  if (await storagePathExists(canonical)) return canonical;
  const legacy = join(repoRoot, ARTIFACT_MOUNT_ROOT, owner.name);
  if (privateFiles) return join(legacy, ".publishers", owner.extensionId.split(".")[0]!);
  const owners = await discoverExtensionStorageOwners(repoRoot, [owner]);
  if (owners.filter((candidate) => candidate.name === owner.name).length > 1)
    throw new Error(
      `Ambiguous extension storage "${owner.name}". Use a writable workspace to migrate publisher-owned files.`,
    );
  return legacy;
};

export const resolveReadExtensionStoragePath = async (
  repoRoot: string,
  path: string,
  declared: readonly ExtensionStorageOwner[],
) => {
  const prefix = `${ARTIFACT_MOUNT_ROOT}/`;
  const segments = path.replaceAll("\\", "/").split("/");
  // A path that climbs out stays as written, so the caller's root boundary rejects it.
  if (!path.replaceAll("\\", "/").startsWith(prefix) || segments.includes("..")) return path;
  const owners = await discoverExtensionStorageOwners(repoRoot, declared);
  const canonical = createLegacyExtensionPathResolver(owners)(path);
  if (!canonical.startsWith(prefix)) return path;
  const [directory, ...tail] = canonical.slice(prefix.length).split("/");
  const owner = owners.find((candidate) => extensionStorageDirectory(candidate.extensionId) === directory);
  if (!owner || (await storagePathExists(join(repoRoot, prefix, directory!)))) return canonical;
  const privatePath = join(ARTIFACT_MOUNT_ROOT, owner.name, ".publishers", owner.extensionId.split(".")[0]!, ...tail);
  if (await storagePathExists(join(repoRoot, privatePath))) return privatePath.replaceAll("\\", "/");
  const legacyRoot = await resolveReadExtensionStorageRoot(repoRoot, owner, false);
  const legacyPath = relative(repoRoot, join(legacyRoot, ...tail));
  if (legacyPath.startsWith("..") || isAbsolute(legacyPath)) return path;
  return legacyPath.replaceAll("\\", "/");
};
