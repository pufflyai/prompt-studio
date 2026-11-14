import { canonicalStoragePath, historicalStoragePath } from "pstdio-api-contracts/extension-host";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary, createWorkspaceFilesMount } from "pstdio-extensions";
import { createObservedFileMount } from "../../../services/shared-files/observed-file-mount";
import type { ExtensionsRouteDeps } from "../deps";
import {
  resolveLocalWorkspaceTarget,
  type WorkspaceTargetInput,
  WorkspaceTargetUnavailableError,
} from "./workspace-target";

export type FileAccess = "read" | "write";

export const resolveWorkspaceFilesPath = async (
  deps: Pick<ExtensionsRouteDeps, "workspaceService">,
  input: WorkspaceTargetInput,
  access: FileAccess,
) => {
  const target = await resolveLocalWorkspaceTarget(deps, input, "file");
  const files = target.workspace.provider_capabilities_json?.files;
  if (files === "none" || (access === "write" && files && files !== "write"))
    throw new WorkspaceTargetUnavailableError(`Workspace provider does not allow file ${access} access.`);
  return target.root;
};

export const createWorkspaceFileMount = (
  resolvePath: (access: FileAccess) => Promise<string>,
  signal?: AbortSignal,
): ArtifactMount => {
  const mount = async (access: FileAccess) => {
    const root =
      access === "read" ? await createReadBoundary(signal)(() => resolvePath(access)) : await resolvePath(access);
    return createObservedFileMount(root, createWorkspaceFilesMount(root, { signal }));
  };
  const listedPath = (query: string | undefined, path: string) =>
    canonicalStoragePath(query ?? "") !== (query ?? "") ? historicalStoragePath(path) : path;
  return {
    exists: async (path) => (await mount("read")).exists(canonicalStoragePath(path ?? "")),
    readText: async (path) => (await mount("read")).readText(canonicalStoragePath(path ?? "")),
    readBytes: async (path) => (await mount("read")).readBytes(canonicalStoragePath(path ?? "")),
    list: async (path) =>
      (await (await mount("read")).list(canonicalStoragePath(path ?? ""))).map((file) => ({
        ...file,
        path: listedPath(path, file.path),
      })),
    listDirs: async (path) =>
      (await (await mount("read")).listDirs(canonicalStoragePath(path ?? ""))).map((entry) => listedPath(path, entry)),
    writeText: async (path, value) => (await mount("write")).writeText(canonicalStoragePath(path), value),
    updateText: async (path, value) => (await mount("write")).updateText(canonicalStoragePath(path), value),
    writeBytes: async (path, value) => (await mount("write")).writeBytes(canonicalStoragePath(path), value),
    delete: async (path) => (await mount("write")).delete(canonicalStoragePath(path ?? "")),
  };
};
