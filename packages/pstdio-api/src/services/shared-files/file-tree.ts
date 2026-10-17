import { posix } from "node:path";
import { normalizeMountRelativePath } from "pstdio-extensions";
import { storageRecordId } from "pstdio-sync";
import { z } from "zod";

const location = { path: z.string(), parent: z.string() };
export const fileNode = z.discriminatedUnion("kind", [
  z.strictObject({ ...location, kind: z.literal("file"), updatedAt: z.string() }),
  z.strictObject({ ...location, kind: z.literal("directory"), id: z.string() }),
]);
export type FileNode = z.infer<typeof fileNode>;
export const fileRecordId = (path: string) => storageRecordId(["artifact-file"], path);
export const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
export const parentPath = (path: string) => posix.dirname(path);
interface NodeRecord {
  recordId: string;
  value: unknown;
  deleted: boolean;
  exists: boolean;
}
const nodeEntries = <T extends NodeRecord>(records: T[]) => {
  const all = new Map<string, { record: T; node: FileNode }>();
  for (const record of records) {
    if (!record.recordId.startsWith('["artifact-file",')) continue;
    // Choosing an absent accepted version leaves an empty journal slot, with no node to project.
    if (record.value === null) continue;
    const node = fileNode.parse(record.value);
    if (normalizeMountRelativePath(node.path) !== node.path || fileRecordId(node.path) !== record.recordId)
      throw new Error("Invalid artifact file identity");
    all.set(node.path, { record, node });
  }
  return all;
};

export const createFileTree = (roots: string[]) => {
  // Package-level containers have stable identities across changes to the declared mounts.
  const implicit = new Set<string>();
  for (const root of roots) {
    implicit.add(normalizeMountRelativePath(root).split("/")[0]!);
  }
  const implicitId = (path: string) => JSON.stringify(["mount-root", path]);
  const ancestors = (path: string) => {
    const result: string[] = [];
    let parent = parentPath(path);
    while (parent !== "." && !implicit.has(parent)) {
      result.unshift(parent);
      parent = parentPath(parent);
    }
    return result;
  };
  const parentId = (path: string, nodes: Map<string, FileNode>) => {
    const parent = parentPath(path);
    if (implicit.has(parent)) return implicitId(parent);
    const node = nodes.get(parent);
    if (node?.kind !== "directory") throw new Error(`Artifact parent is not a directory: ${parent}`);
    return node.id;
  };
  const active = <T extends NodeRecord>(records: T[]) => {
    const all = nodeEntries(records);
    const live = new Map<string, { record: T; node: FileNode }>();
    for (const [path, entry] of [...all].sort(([a], [b]) => a.split("/").length - b.split("/").length)) {
      if (!entry.record.exists || entry.record.deleted || implicit.has(path)) continue;
      const parent = parentPath(path);
      const directory = live.get(parent)?.node;
      let identity = directory?.kind === "directory" ? directory.id : null;
      if (implicit.has(parent)) identity = implicitId(parent);
      // Children belong to one directory lifetime. A later directory at the same path cannot revive them.
      if (entry.node.parent === identity) live.set(path, entry);
    }
    return { all, live };
  };
  return {
    implicit,
    ancestors,
    parentId,
    active,
    assertWritable(path: string) {
      if (!path || roots.some((root) => within(root, path)))
        throw new Error("Declared artifact roots must remain directories");
    },
    assertDeletable(path: string) {
      if (roots.some((root) => within(root, path))) throw new Error("Declared artifact roots cannot be deleted");
    },
  };
};
