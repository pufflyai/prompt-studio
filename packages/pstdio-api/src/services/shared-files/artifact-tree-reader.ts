import { posix } from "node:path";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createFileTree, within } from "./file-tree";

type Storage = Awaited<ReturnType<ExtensionsRouteDeps["extensionStorageService"]["open"]>>;

/** Listings come from shared data even while an older source keeps private disk edits. */
export const artifactTreeReader = (storage: Storage, prefix: string, roots: string[]) => {
  const tree = createFileTree(roots);
  const entries = async () =>
    [...tree.active(await storage.records.list('["artifact-file",')).live.values()].filter((entry) =>
      within(entry.node.path, prefix),
    );
  const relative = (path: string) => posix.relative(prefix, path);
  return {
    list: async (pattern = "**/*") => {
      const glob = new Bun.Glob(pattern);
      return (await entries())
        .flatMap(({ node, record }) =>
          node.kind === "file" && glob.match(relative(node.path))
            ? [{ path: relative(node.path), size: record.asset?.byteLength, updatedAt: node.updatedAt }]
            : [],
        )
        .sort((a, b) => a.path.localeCompare(b.path));
    },
    listDirs: async (path: string) =>
      (await entries())
        .filter(({ node }) => node.kind === "directory" && posix.dirname(node.path) === path)
        .map(({ node }) => relative(node.path))
        .sort(),
  };
};
