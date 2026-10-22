import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAssetTransfersDBService,
  createDb,
  createExtensionStorageDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createAssetBytesStorage } from "pstdio-storage";
import { storageRecordId } from "pstdio-sync";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import { createAssetTransferService } from "../asset-transfer-service";
import { createSharedArtifactMount } from "./artifact-mount";
import { createFileTree, type FileNode } from "./file-tree";
import { storageObserver } from "./storage-observation";

export const artifactFilesFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "artifact-files-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const connection = await createDb({ path: ":memory:" });
  const owner = { workbenchId: "workbench", extensionId: "example.documents" };
  await createProjectsDBService(connection.db).create({ id: owner.workbenchId, name: "Documents" });
  const assets = createAssetTransferService({
    transfers: createAssetTransfersDBService(connection.db),
    bytes: createAssetBytesStorage(join(root, "bytes")),
  });
  const deps = {
    extensionStorageService: createExtensionStorageDBService(connection.db, storageObserver),
    assetTransferService: assets,
  };
  const storage = await deps.extensionStorageService.open({ owner, assets: createRecordAssets(assets, owner) });
  const repoRoot = join(root, "project");
  const input = {
    projectId: owner.workbenchId,
    extensionId: owner.extensionId,
    repoRoot,
    name: "example-documents",
    mountPath: "documents",
    mountPaths: ["documents", "documents/nested"],
  };
  const mount = (mountPath = "documents") =>
    createSharedArtifactMount(deps, {
      projectId: owner.workbenchId,
      extensionId: owner.extensionId,
      repoRoot,
      name: "example-documents",
      mountPath,
      mountPaths: input.mountPaths,
    });
  const pathFor = (path: string) => join(repoRoot, ".pstdio/extension-storage/example.documents", path);
  const recordId = (path: string) => storageRecordId(["artifact-file"], path);
  const replace = async (path: string, value: string | null) => {
    const tree = createFileTree(input.mountPaths);
    const nodes = new Map(
      [...tree.active(await storage.records.list()).live].map(([path, entry]) => [path, entry.node]),
    );
    const edits = [];
    if (value !== null)
      for (const parent of tree.ancestors(path)) {
        const current = await storage.records.read(recordId(parent));
        const node: FileNode =
          nodes.get(parent)?.kind === "directory"
            ? nodes.get(parent)!
            : {
                path: parent,
                kind: "directory",
                id: crypto.randomUUID(),
                parent: tree.parentId(parent, nodes),
              };
        nodes.set(parent, node);
        edits.push({
          recordId: current.recordId,
          expectedRevision: current.revision,
          replace: node,
          asset: null,
          ...(!current.exists || current.deleted ? { deleted: false } : {}),
        });
      }
    const previous = await storage.records.read(recordId(path));
    const asset = value === null ? null : await assets.stage(owner, crypto.randomUUID(), new Blob([value]));
    await storage.records.commit({
      operationId: crypto.randomUUID(),
      edits: [
        ...edits,
        {
          recordId: recordId(path),
          expectedRevision: previous.revision,
          ...(value !== null && {
            replace: { path, kind: "file", parent: tree.parentId(path, nodes), updatedAt: new Date().toISOString() },
          }),
          asset,
          deleted: value === null,
        },
      ],
    });
  };
  return {
    root,
    db: connection.db,
    deps,
    input,
    owner,
    storage,
    assets,
    mount,
    pathFor,
    recordId,
    replace,
    close: async () => {
      await connection.close();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    },
  };
};
