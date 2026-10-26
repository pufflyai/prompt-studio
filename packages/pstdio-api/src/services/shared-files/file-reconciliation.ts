import { initialRecordRevision } from "pstdio-sync";
import type { StorageGroup } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { createSharedArtifactMount } from "./artifact-mount";
import { absentFile, type createFileProjectionIO, sameFile } from "./file-io";
import type { FileProjection, fileProjection } from "./file-state";
import { type createFileTree, type FileNode, fileRecordId, within } from "./file-tree";

type Storage = Awaited<ReturnType<ExtensionsRouteDeps["extensionStorageService"]["open"]>>;
export const createFileReconciler = (input: {
  owner: { workbenchId: string; extensionId: string };
  roots: string[];
  tree: ReturnType<typeof createFileTree>;
  local: Pick<ReturnType<typeof createSharedArtifactMount>, "list" | "listDirs">;
  io: ReturnType<typeof createFileProjectionIO>;
  assets: ExtensionsRouteDeps["assetTransferService"];
  projection: ReturnType<typeof fileProjection>;
  open: () => Promise<Storage>;
  signal?: AbortSignal;
  assertWritable?: () => Promise<void>;
}) => {
  const { tree, io } = input;
  const included = (path: string) =>
    input.roots.some((root) => within(path, root) || within(root, path)) && !tree.implicit.has(path);
  type Disk = Map<string, Awaited<ReturnType<typeof io.source>>>;
  const identity = (entry: FileProjection[string] | undefined) => ({
    kind: entry?.node?.kind ?? null,
    hash: entry?.hash ?? null,
  });
  const directoryNode = (path: string, previous: FileProjection[string] | undefined, nodes: Map<string, FileNode>) => {
    if (previous?.node?.kind === "directory") return previous.node;
    return { path, kind: "directory" as const, id: crypto.randomUUID(), parent: tree.parentId(path, nodes) };
  };
  const scanDisk = async () => {
    const disk: Disk = new Map();
    for (const root of input.roots) {
      for (const file of await input.local.list(`${root}/**/*`)) disk.set(file.path, await io.source(file.path));
      for (const path of [...tree.ancestors(`${root}/_`), root]) {
        if (included(path)) disk.set(path, await io.source(path));
      }
    }
    const directories = async (path: string) => {
      for (const child of await input.local.listDirs(path)) {
        if (!tree.implicit.has(child)) disk.set(child, await io.source(child));
        await directories(child);
      }
    };
    for (const root of input.roots) await directories(root);
    return disk;
  };
  const addClaims = (
    changes: Map<string, StorageGroup["edits"][number]>,
    nodes: Map<string, FileNode>,
    state: FileProjection,
  ) => {
    for (const [path, edit] of [...changes]) {
      if (edit.deleted) continue;
      for (const parent of tree.ancestors(path)) {
        if (changes.has(parent)) continue;
        const node = nodes.get(parent);
        if (node?.kind !== "directory") throw new Error(`Artifact parent is not a directory: ${parent}`);
        changes.set(parent, {
          recordId: fileRecordId(parent),
          expectedRevision: state[parent]?.revision ?? initialRecordRevision(input.owner, fileRecordId(parent)),
          replace: node,
          asset: null,
        });
      }
    }
  };
  const editFor = async (
    path: string,
    found: Awaited<ReturnType<typeof io.source>>,
    previous: FileProjection[string] | undefined,
    nodes: Map<string, FileNode>,
  ) => {
    const node: FileNode | null =
      found?.kind === "file"
        ? { path, kind: "file", parent: tree.parentId(path, nodes), updatedAt: new Date().toISOString() }
        : (nodes.get(path) ?? null);
    return {
      recordId: fileRecordId(path),
      expectedRevision: previous?.revision ?? initialRecordRevision(input.owner, fileRecordId(path)),
      ...(node && { replace: node }),
      asset: found?.file ? await input.assets.stage(input.owner, crypto.randomUUID(), found.file, input.signal) : null,
      deleted: !found,
    };
  };
  const capture = async (storage: Storage, state: FileProjection) => {
    const canonical = tree.active(await storage.records.list());
    const disk = await scanDisk();
    const paths = new Set([...disk.keys(), ...Object.keys(state).filter(included)]);
    const nodes = new Map<string, FileNode>();
    const changes = new Map<string, StorageGroup["edits"][number]>();
    const alreadySaved = (path: string, found: Awaited<ReturnType<typeof io.source>>) => {
      const live = canonical.live.get(path);
      if (!found) return !live;
      if (live?.node.kind !== found.kind) return false;
      return found.kind === "directory" || live.record.asset?.sha256 === found.hash;
    };
    const capturePath = async (path: string) => {
      const found = disk.get(path) ?? (await io.source(path));
      disk.set(path, found);
      const previous = state[path];
      const matched = sameFile(identity(previous), found ?? absentFile);
      if (found?.kind === "directory") {
        nodes.set(path, directoryNode(path, previous, nodes));
      }
      if (matched) return;
      // A fresh projection may already have exactly the bytes on disk.
      if (alreadySaved(path, found)) {
        const saved = canonical.live.get(path);
        if (saved) nodes.set(path, saved.node);
        return;
      }
      changes.set(path, await editFor(path, found, previous, nodes));
    };
    for (const path of [...paths].sort((a, b) => a.split("/").length - b.split("/").length)) await capturePath(path);
    addClaims(changes, nodes, state);
    if (changes.size) {
      await input.assertWritable?.();
      await storage.records.commit({ operationId: crypto.randomUUID(), edits: [...changes.values()] });
    }
    return { disk, paths };
  };
  const project = async (storage: Storage, state: FileProjection, captured: Awaited<ReturnType<typeof capture>>) => {
    const treeView = tree.active(await storage.records.list());
    const paths = new Set([...captured.paths, ...[...treeView.all.keys()].filter(included)]);
    const targets = [...paths].map((path) => ({ path, entry: treeView.live.get(path) }));
    // Clear removed descendants first, then create directories before their children.
    targets.sort((a, b) => {
      if (!a.entry !== !b.entry) return a.entry ? 1 : -1;
      return a.entry
        ? a.path.split("/").length - b.path.split("/").length
        : b.path.split("/").length - a.path.split("/").length;
    });
    let complete = true;
    for (const { path, entry } of targets) {
      const expected = captured.disk.get(path) ?? absentFile;
      const hash = entry?.node.kind === "file" ? (entry.record.asset?.sha256 ?? null) : null;
      const target = { kind: entry?.node.kind ?? null, hash };
      if (!sameFile(expected, target) && !(await io.install(path, target, entry?.record.asset, expected))) {
        complete = false;
        continue;
      }
      if (sameFile(expected, target) && !sameFile((await io.source(path)) ?? absentFile, expected)) {
        complete = false;
        continue;
      }
      const record = entry?.record ?? (await storage.records.read(fileRecordId(path)));
      state[path] = { node: entry?.node ?? null, hash, revision: record.revision };
    }
    return complete;
  };
  return async () => {
    input.signal?.throwIfAborted();
    const storage = await input.open();
    const state = await input.projection.read();
    let complete = false;
    while (!complete) {
      input.signal?.throwIfAborted();
      complete = await project(storage, state, await capture(storage, state));
      await input.projection.write(state);
    }
    return storage;
  };
};
