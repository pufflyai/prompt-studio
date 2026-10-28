import { isDeepStrictEqual } from "node:util";
import type { AssetReference } from "pstdio-api-contracts";
import { initialRecordRevision, nativeTextAssetKey } from "pstdio-sync/records";
import type { StorageGroup } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { createSharedArtifactMount } from "./artifact-mount";
import { absentFile, type createFileProjectionIO, type FileIdentity, sameFile } from "./file-io";
import { createFileReconciliationScope } from "./file-reconciliation-scope";
import type { FileProjection, fileProjection } from "./file-state";
import { type createFileTree, type FileNode, fileRecordId } from "./file-tree";
import { createNativeArtifactProjection, createPendingNativeFiles } from "./native-artifact-projection";

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
  storageService: ExtensionsRouteDeps["extensionStorageService"];
}) => {
  const { tree, io } = input;
  const native = createNativeArtifactProjection(input);
  const scope = createFileReconciliationScope(input);
  const { included } = scope;
  const identity = (entry: FileProjection[string] | undefined) => ({
    kind: entry?.node?.kind ?? null,
    hash: entry?.hash ?? null,
  });
  const directoryNode = (path: string, previous: FileProjection[string] | undefined, nodes: Map<string, FileNode>) => {
    if (previous?.node?.kind === "directory") return previous.node;
    return { path, kind: "directory" as const, id: crypto.randomUUID(), parent: tree.parentId(path, nodes) };
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
  const observesNative = (
    record: Awaited<ReturnType<Storage["records"]["read"]>> | undefined,
    found: Awaited<ReturnType<typeof io.source>>,
    previous: FileProjection[string] | undefined,
  ) => record && nativeTextAssetKey(record) && (found?.kind === "file" || (!found && !previous?.node));
  const capture = async (storage: Storage, prepared: Awaited<ReturnType<typeof scope.read>>) => {
    const { canonical, disk, state } = prepared;
    const paths = new Set([...disk.keys(), ...Object.keys(state).filter(included)]);
    const nodes = new Map<string, FileNode>();
    const changes = new Map<string, StorageGroup["edits"][number]>();
    const pending = createPendingNativeFiles(tree.ancestors);
    const alreadySaved = (path: string, found: Awaited<ReturnType<typeof io.source>>) => {
      const live = canonical.live.get(path);
      if (!found) return !live;
      if (live?.node.kind !== found.kind) return false;
      return found.kind === "directory" || live.record.asset?.sha256 === found.hash;
    };
    const captureNative = async (path: string, found: Awaited<ReturnType<typeof io.source>>) => {
      const entry = canonical.all.get(path);
      if (!entry || !observesNative(entry.record, found, state[path])) return false;
      await pending.run(path, () => native.observe(path, entry.record, found));
      if (canonical.live.has(path)) nodes.set(path, entry.node);
      return true;
    };
    const capturePath = async (path: string) => {
      const found = disk.get(path) ?? (await io.source(path));
      disk.set(path, found);
      const previous = state[path];
      if (await captureNative(path, found)) return;
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
    return { disk, paths, pending, address: prepared.address };
  };
  const materialize = async (
    path: string,
    target: FileIdentity,
    asset: AssetReference | null | undefined,
    expected: FileIdentity,
  ) => {
    if (sameFile(expected, target)) return sameFile((await io.source(path)) ?? absentFile, expected);
    return io.install(path, target, asset, expected);
  };
  const projectFile = async (
    path: string,
    entry: { record: Awaited<ReturnType<Storage["records"]["read"]>>; node: FileNode } | undefined,
    expected: FileIdentity,
  ) => {
    if (entry && nativeTextAssetKey(entry.record)) return native.project(path, entry.record, expected);
    const hash = entry?.node.kind === "file" ? (entry.record.asset?.sha256 ?? null) : null;
    const target = { kind: entry?.node.kind ?? null, hash };
    return { hash, complete: await materialize(path, target, entry?.record.asset, expected) };
  };
  const project = async (storage: Storage, state: FileProjection, captured: Awaited<ReturnType<typeof capture>>) => {
    const treeView = tree.active(await scope.records(storage, captured.address));
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
    const changes: FileProjection = {};
    for (const { path, entry } of targets) {
      // A record pointer can arrive before its text. Leave that copy and structural
      // replacements above it untouched so this pass can return and download the source.
      if (captured.pending.blocks(path, entry?.node.kind)) continue;
      const expected = captured.disk.get(path) ?? absentFile;
      const result = await captured.pending.run(path, () => projectFile(path, entry, expected));
      if (!result) continue;
      if (!result.complete) {
        complete = false;
        continue;
      }
      const record = entry?.record ?? (await storage.records.read(fileRecordId(path)));
      const next = { node: entry?.node ?? null, hash: result.hash, revision: record.revision };
      if (!isDeepStrictEqual(state[path], next)) {
        state[path] = next;
        changes[path] = next;
      }
    }
    return { complete, changes };
  };
  return async (target?: string) => {
    input.signal?.throwIfAborted();
    const storage = await input.open();
    let complete = false;
    while (!complete) {
      input.signal?.throwIfAborted();
      const prepared = await scope.read(storage, target);
      const projected = await project(storage, prepared.state, await capture(storage, prepared));
      complete = projected.complete;
      await input.projection.write(projected.changes);
    }
    return storage;
  };
};
