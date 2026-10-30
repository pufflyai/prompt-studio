import { posix, resolve } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import {
  createFileMount,
  createSafeFileRoot,
  normalizeMountRelativePath,
  resolveArtifactMountRoot,
} from "pstdio-extensions";
import { nativeTextAssetKey } from "pstdio-sync/records";
import type { StorageGroup } from "pstdio-sync-contracts";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { PublicationUpdateRequiredError } from "../../features/extensions/publication/types";
import { artifactTreeReader } from "./artifact-tree-reader";
import { createFileProjectionIO } from "./file-io";
import { createFileReconciler } from "./file-reconciliation";
import { fileProjection, serializeFiles } from "./file-state";
import { createFileTree, type FileNode, fileRecordId, within } from "./file-tree";
import { withoutStorageObservation } from "./storage-observation";

type FileDeps = Pick<ExtensionsRouteDeps, "extensionStorageService" | "assetTransferService">;
const missing = (path: string) => Object.assign(new Error(`Artifact not found: ${path}`), { code: "ENOENT" });

export const createSharedArtifactMount = (
  deps: FileDeps,
  input: {
    projectId: string;
    extensionId: string;
    repoRoot: string;
    name: string;
    mountPath: string;
    mountPaths?: string[];
    signal?: AbortSignal;
    onWrite?: (path: string) => void;
    assertWritable?: () => Promise<void>;
    resolveWriteRoot?: () => Promise<string>;
  },
) => {
  const owner = { workbenchId: input.projectId, extensionId: input.extensionId };
  const prefix = normalizeMountRelativePath(input.mountPath);
  const roots = input.mountPaths ?? [prefix];
  const tree = createFileTree(roots);
  const root = resolveArtifactMountRoot(input);
  const boundary = createSafeFileRoot(root);
  const assertBoundary = async (path: string) => {
    let current = normalizeMountRelativePath(path);
    while (!(await boundary.tryResolveExisting(current)) && current) {
      const parent = posix.dirname(current);
      current = parent === "." ? "" : parent;
    }
  };
  const packageRoot = root.slice(0, -prefix.length - 1);
  const key = JSON.stringify([owner, packageRoot]);
  const projection = fileProjection(key, deps.extensionStorageService.fileProjections);
  const assets = deps.assetTransferService;
  const fullPath = (path: string) => posix.join(prefix, normalizeMountRelativePath(path));
  const open = () =>
    deps.extensionStorageService.open({ owner, assets: createRecordAssets(assets, owner, input.signal) });
  const io = createFileProjectionIO({
    ...input,
    root: packageRoot,
    packageRoot,
    roots,
    owner,
    local: createFileMount(packageRoot, input.signal),
    assets,
    beforeWrite: async () => {
      if (input.resolveWriteRoot && resolve(await input.resolveWriteRoot()) !== resolve(input.repoRoot))
        throw new Error("Workspace changed while applying artifact files. Retry the operation.");
    },
  });
  const reconcile = createFileReconciler({
    owner,
    storageService: deps.extensionStorageService,
    roots,
    tree,
    local: createFileMount(packageRoot, input.signal),
    io,
    assets,
    projection,
    open,
    signal: input.signal,
    assertWritable: input.assertWritable,
  });
  const pointTree = async (storage: Awaited<ReturnType<typeof open>>, target: string) =>
    tree.active(
      await Promise.all([...tree.ancestors(target), target].map((path) => storage.records.read(fileRecordId(path)))),
    );
  const run = <T>(action: (storage: Awaited<ReturnType<typeof open>>) => Promise<T>, target?: string) =>
    serializeFiles(key, async () => {
      try {
        await input.assertWritable?.();
      } catch (error) {
        if (!(error instanceof PublicationUpdateRequiredError)) throw error;
        return action(await open());
      }
      return action(await withoutStorageObservation(() => reconcile(target)));
    });
  const write = (path: string, value: Blob, update: boolean) =>
    run(async (storage) => {
      const target = fullPath(path);
      tree.assertWritable(target);
      await assertBoundary(path);
      const { live } = await pointTree(storage, target);
      const before = await storage.records.read(fileRecordId(target));
      if (live.get(target)?.node.kind === "directory") throw new Error(`Artifact is a directory: ${path}`);
      if (update && !live.has(target)) throw missing(path);
      const nodes = new Map([...live].map(([path, entry]) => [path, entry.node]));
      const edits: StorageGroup["edits"] = [];
      for (const parent of tree.ancestors(target)) {
        const existing = nodes.get(parent);
        if (existing?.kind === "file") throw new Error(`Artifact parent is not a directory: ${parent}`);
        const node: FileNode = existing ?? {
          path: parent,
          kind: "directory",
          id: crypto.randomUUID(),
          parent: tree.parentId(parent, nodes),
        };
        nodes.set(parent, node);
        const record = await storage.records.read(fileRecordId(parent));
        edits.push({
          recordId: record.recordId,
          expectedRevision: record.revision,
          replace: node,
          asset: null,
          ...(!existing && { deleted: false }),
        });
      }
      if (nativeTextAssetKey(before)) {
        await input.assertWritable?.();
        await storage.records.writeTextAsset({
          recordId: before.recordId,
          content: await value.text(),
          replace: before.value,
        });
        await withoutStorageObservation(() => reconcile(target));
        return;
      }
      const asset = await assets.stage(owner, crypto.randomUUID(), value, input.signal);
      edits.push({
        recordId: before.recordId,
        expectedRevision: before.revision,
        replace: {
          path: target,
          kind: "file" as const,
          parent: tree.parentId(target, nodes),
          updatedAt: new Date().toISOString(),
        },
        asset,
        deleted: false,
      });
      await input.assertWritable?.();
      await storage.records.commit({ operationId: crypto.randomUUID(), edits });
      await withoutStorageObservation(() => reconcile(target));
    }, fullPath(path));
  const read = (path: string) =>
    run(async (storage) => {
      await assertBoundary(path);
      const entry = (await pointTree(storage, fullPath(path))).live.get(fullPath(path));
      if (entry?.node.kind !== "file" || !entry.record.asset) throw missing(path);
      const key = nativeTextAssetKey(entry.record);
      if (key)
        return new Blob([await deps.extensionStorageService.openNativeTextDocument({ owner, fileId: key }).read()]);
      return assets.read(owner, entry.record.asset, input.signal);
    }, fullPath(path));
  const api: ArtifactMount = {
    exists: (path) =>
      run(
        async (storage) =>
          fullPath(path) === prefix || (await pointTree(storage, fullPath(path))).live.has(fullPath(path)),
        fullPath(path),
      ),
    readText: async (path) =>
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        await new Response(await read(path)).arrayBuffer(),
      ),
    readBytes: async (path) => new Uint8Array(await new Response(await read(path)).arrayBuffer()),
    writeText: (path, value) => write(path, new Blob([value], { type: "text/plain" }), false),
    updateText: (path, value) => write(path, new Blob([value], { type: "text/plain" }), true),
    writeBytes: (path, value) => write(path, new Blob([new Uint8Array(value)]), false),
    list: (pattern) => run(async (storage) => artifactTreeReader(storage, prefix, roots).list(pattern)),
    listDirs: (path = "") =>
      run(async (storage) => artifactTreeReader(storage, prefix, roots).listDirs(fullPath(path))),
    delete: (path) =>
      run(async (storage) => {
        const target = fullPath(path);
        tree.assertDeletable(target);
        await assertBoundary(path);
        const entries = [...tree.active(await storage.records.list('["artifact-file",')).live.values()].filter(
          ({ node }) => within(node.path, target),
        );
        if (!entries.length) throw missing(path);
        await input.assertWritable?.();
        await storage.records.commit({
          operationId: crypto.randomUUID(),
          edits: entries.map(({ record }) => ({
            recordId: record.recordId,
            expectedRevision: record.revision,
            deleted: true,
            asset: null,
          })),
        });
        await withoutStorageObservation(reconcile);
      }),
  };
  return { ...api, root, refresh: () => run(async () => {}) };
};
