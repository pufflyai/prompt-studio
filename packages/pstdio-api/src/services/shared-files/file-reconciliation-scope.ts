import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { createFileProjectionIO } from "./file-io";
import type { fileProjection } from "./file-state";
import { type createFileTree, fileRecordId, within } from "./file-tree";

type Storage = Awaited<ReturnType<ExtensionsRouteDeps["extensionStorageService"]["open"]>>;
interface ScopeAddress {
  paths?: string[];
  subtree?: string;
}
export const createFileReconciliationScope = (input: {
  roots: string[];
  tree: ReturnType<typeof createFileTree>;
  io: ReturnType<typeof createFileProjectionIO>;
  local: Pick<ArtifactMount, "list" | "listDirs">;
  projection: ReturnType<typeof fileProjection>;
}) => {
  const included = (path: string) =>
    input.roots.some((root) => within(path, root) || within(root, path)) && !input.tree.implicit.has(path);
  const records = async (storage: Storage, scope: ScopeAddress) => {
    if (!scope.paths) return storage.records.list('["artifact-file",');
    const points = await Promise.all(scope.paths.map((path) => storage.records.read(fileRecordId(path))));
    if (!scope.subtree) return points;
    const descendants = await storage.records.list(JSON.stringify(["artifact-file", `${scope.subtree}/`]).slice(0, -2));
    return [...new Map([...points, ...descendants].map((record) => [record.recordId, record])).values()];
  };
  const scan = async (roots: string[], points: string[] = []) => {
    const disk = new Map<string, Awaited<ReturnType<typeof input.io.source>>>();
    const put = async (path: string) => {
      if (included(path) && !disk.has(path)) disk.set(path, await input.io.source(path));
    };
    for (const path of points) await put(path);
    const directories = async (path: string) => {
      for (const child of await input.local.listDirs(path)) {
        await put(child);
        await directories(child);
      }
    };
    for (const root of roots) {
      for (const file of await input.local.list(`${root}/**/*`)) await put(file.path);
      for (const path of [...input.tree.ancestors(`${root}/_`), root]) await put(path);
      await directories(root);
    }
    return disk;
  };
  return {
    included,
    records,
    async read(storage: Storage, target?: string) {
      const paths = target === undefined ? undefined : [...input.tree.ancestors(target), target].filter(included);
      let state = await input.projection.read(paths);
      let canonical = input.tree.active(await records(storage, { paths }));
      let disk = await scan(paths ? [] : input.roots, paths);
      // Replacing an unchanged directory must clear its own old descendants first.
      // It does not require reading the owner's other files or resources.
      const subtree = paths?.find(
        (path) =>
          disk.get(path)?.kind === "directory" &&
          state[path]?.node?.kind === "directory" &&
          canonical.live.get(path)?.node.kind !== "directory",
      );
      if (subtree) {
        state = await input.projection.read(paths, subtree);
        canonical = input.tree.active(await records(storage, { paths, subtree }));
        disk = await scan([subtree], paths);
      }
      return { address: { paths, subtree }, state, canonical, disk };
    },
  };
};
