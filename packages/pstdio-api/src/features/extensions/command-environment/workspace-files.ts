import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveLocalWorkspaceTarget, type WorkspaceTargetInput } from "./workspace-target";

export type FileAccess = "read" | "write";

export const resolveWorkspaceFilesPath = async (
  deps: ExtensionsRouteDeps,
  input: WorkspaceTargetInput,
  access: FileAccess,
) => {
  const target = await resolveLocalWorkspaceTarget(deps, input, "file");
  const files = target.workspace.provider_capabilities_json?.files;
  if (files === "none" || (access === "write" && files && files !== "write"))
    throw new Error(`Workspace provider does not allow file ${access} access.`);
  return target.root;
};

export const createWorkspaceFileMount = (resolvePath: (access: FileAccess) => Promise<string>): ArtifactMount => {
  const mount = async (access: FileAccess) => createFileMount(await resolvePath(access));
  return {
    exists: async (path) => (await mount("read")).exists(path),
    readText: async (path) => (await mount("read")).readText(path),
    readBytes: async (path) => (await mount("read")).readBytes(path),
    list: async (path) => (await mount("read")).list(path),
    listDirs: async (path) => (await mount("read")).listDirs(path),
    writeText: async (path, value) => (await mount("write")).writeText(path, value),
    updateText: async (path, value) => (await mount("write")).updateText(path, value),
    writeBytes: async (path, value) => (await mount("write")).writeBytes(path, value),
    delete: async (path) => (await mount("write")).delete(path),
  };
};
