import { ARTIFACT_MOUNT_ROOT, type ExtensionStorageOwner, extensionStorageDirectory } from "./extension-storage-path";

/** @deprecated Name-only storage paths will be removed with the next breaking extension API. */
export const createLegacyExtensionPathResolver = (owners: readonly ExtensionStorageOwner[]) => {
  const warned = new Set<string>();
  const distinctOwners = [...new Map(owners.map((owner) => [owner.extensionId, owner])).values()];
  return (path: string) => {
    const normalized = path.replaceAll("\\", "/");
    const prefix = `${ARTIFACT_MOUNT_ROOT}/`;
    if (!normalized.startsWith(prefix)) return path;
    const [name, ...tail] = normalized.slice(prefix.length).split("/");
    if (!name || name.includes(".")) return path;
    const matches = distinctOwners.filter(
      (owner) =>
        owner.extensionId.split(".")[1] === name &&
        (tail[0] !== ".publishers" || owner.extensionId.split(".")[0] === tail[1]),
    );
    if (matches.length > 1)
      throw new Error(
        `Ambiguous extension storage "${name}". Use ${matches.map((owner) => owner.extensionId).join(" or ")}.`,
      );
    const owner = matches[0];
    if (!owner) return path;
    if (tail[0] === ".publishers") {
      if (tail[1] !== owner.extensionId.split(".")[0]) throw new Error("Legacy path belongs to another publisher");
      tail.splice(0, 2);
    }
    const canonical = `${prefix}${extensionStorageDirectory(owner.extensionId)}${tail.length ? `/${tail.join("/")}` : ""}`;
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(
        `Deprecated extension storage "${prefix}${name}"; use "${prefix}${extensionStorageDirectory(owner.extensionId)}".`,
      );
    }
    return canonical;
  };
};
