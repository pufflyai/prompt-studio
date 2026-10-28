import { createHash } from "node:crypto";
import { posix } from "node:path";
import { createNativeSourceKey, type NativeDocumentSource } from "pstdio-api-contracts";
import { createFileMount, normalizeMountRelativePath } from "pstdio-extensions";
import {
  hasTextSourceImport,
  importTextSource,
  readTextDocumentSeed,
  type StorageOwner,
  StorageRevisionChangedError,
  storageRecordId,
} from "pstdio-sync";
import { resolveWorkspaceFilesPath } from "../../features/extensions/command-environment/workspace-files";
import { WorkspaceTargetUnavailableError } from "../../features/extensions/command-environment/workspace-target";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { ProjectFolderMissingError } from "../../features/projects/project-folder-missing";
import { fileRecordId } from "../shared-files/file-tree";
import { workspaceFileObservationKey } from "../shared-files/observed-file-mount";
import { withStorageObservation } from "../shared-files/storage-observation";
import { NativeDocumentSourceError } from "./source-error";

const unavailable = (message: string) =>
  new NativeDocumentSourceError(404, "native_document_source_unavailable", message);
const workspaceRoot = async (deps: ExtensionsRouteDeps, projectId: string) => {
  try {
    return await resolveWorkspaceFilesPath(deps, { projectId }, "read");
  } catch (error) {
    if (error instanceof WorkspaceTargetUnavailableError || error instanceof ProjectFolderMissingError)
      throw unavailable(error.message);
    throw error;
  }
};
const readWorkspaceSource = async (root: string, path: string) => {
  try {
    return await createFileMount(root).readBytes(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR" || code === "EACCES")
      throw unavailable("The shared workspace file is unavailable");
    throw error;
  }
};

export const resolveNativeSource = async (
  deps: ExtensionsRouteDeps,
  owner: StorageOwner,
  source: NativeDocumentSource,
) => {
  if (source.kind === "record")
    return {
      documentKey: createNativeSourceKey(["record", source.recordId, source.field]),
      recordId: source.recordId,
      field: source.field,
    };
  if (source.kind === "collection") {
    const recordId = storageRecordId(["project", owner.workbenchId, "collection", source.collection], source.id);
    const field = `/value${source.field}`;
    return { documentKey: createNativeSourceKey(["record", recordId, field]), recordId, field };
  }
  if (source.kind === "blob")
    return {
      documentKey: createNativeSourceKey(["blob", source.identity]),
      recordId: storageRecordId(["blob-file"], source.id),
    };
  if (source.kind === "workspace")
    return { documentKey: createNativeSourceKey(["workspace", normalizeMountRelativePath(source.path)]) };
  const snapshot = await deps.extensionRuntimeCatalog.get(owner.workbenchId);
  const mount = snapshot.runtime.artifactMounts.find(
    (mount) => mount.extensionId === owner.extensionId && (mount.id === source.mount || mount.localId === source.mount),
  );
  if (!mount) throw unavailable("The declared text source mount is unavailable");
  const path = posix.join(mount.relativePath, normalizeMountRelativePath(source.path));
  return { documentKey: createNativeSourceKey(["artifact", mount.id, source.identity]), recordId: fileRecordId(path) };
};

export const resolveNativeLoadedSource = async (
  deps: ExtensionsRouteDeps,
  input: {
    owner: StorageOwner;
    source: NativeDocumentSource;
    content: string;
    versions: Record<string, string>;
  },
) => {
  const address = await resolveNativeSource(deps, input.owner, input.source);
  let copy: { projectionKey: string; content: string } | undefined;
  if (input.source.kind === "workspace") {
    const root = await workspaceRoot(deps, input.owner.workbenchId);
    const projectionKey = workspaceFileObservationKey(root, input.source.path);
    const bytes = await readWorkspaceSource(root, input.source.path);
    const revision = createHash("sha256").update(bytes).digest("hex");
    if (input.versions[projectionKey] !== revision) throw new StorageRevisionChangedError();
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      throw new NativeDocumentSourceError(
        400,
        "native_document_source_invalid",
        "The shared workspace file is not valid UTF-8",
      );
    }
    if (content !== input.content)
      throw new NativeDocumentSourceError(
        400,
        "native_document_source_invalid",
        "A shared Markdown view must load its full declared source",
      );
    copy = { projectionKey, content };
  }
  return { documentKey: address.documentKey, copy };
};

export const initializeNativeSource = async (
  deps: ExtensionsRouteDeps,
  loaded: {
    owner: StorageOwner;
    documentKey: string;
    content: { content?: string; documentSource?: NativeDocumentSource };
    fileStorageVersions: Record<string, string>;
  },
) => {
  const source = loaded.content.documentSource;
  if (!source) throw new Error("This view has no declared text source");
  const address = await resolveNativeSource(deps, loaded.owner, source);
  if (address.documentKey !== loaded.documentKey) throw new Error("The view changed its declared text source");
  const text = deps.extensionStorageService.openNativeTextDocument({
    owner: loaded.owner,
    fileId: address.documentKey,
  });
  if (source.kind === "workspace") {
    await text.store.transaction(loaded.owner, async ({ document }) => {
      if (hasTextSourceImport(document, address.documentKey)) await readTextDocumentSeed(document);
      else await importTextSource(document, address.documentKey, loaded.content.content ?? "");
    });
  } else if (address.recordId !== undefined) {
    const storage = await deps.extensionStorageService.open({ owner: loaded.owner });
    const observed = await withStorageObservation(loaded.fileStorageVersions, () =>
      storage.records.bindText({ ...address, recordId: address.recordId, content: loaded.content.content ?? "" }),
    );
    loaded.fileStorageVersions = { ...loaded.fileStorageVersions, ...observed.versions };
    await text.read();
  }
};
