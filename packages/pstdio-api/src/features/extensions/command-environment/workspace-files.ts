import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount, createReadBoundary } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveLocalWorkspaceTarget, type WorkspaceTargetInput } from "./workspace-target";

export type FileAccess = "read" | "write";

const restoreAliasPath = (requested: string, translated: string, path: string) => {
  if (requested === translated) return path;
  const original = requested.replaceAll("\\", "/").split("/");
  const canonical = translated.split("/");
  while (original.length && canonical.length && original.at(-1) === canonical.at(-1)) {
    original.pop();
    canonical.pop();
  }
  const prefix = canonical.join("/");
  if (path === prefix) return original.join("/");
  return path.startsWith(`${prefix}/`) ? `${original.join("/")}${path.slice(prefix.length)}` : path;
};

export const resolveWorkspaceFilesPath = async (
  deps: Pick<ExtensionsRouteDeps, "workspaceService">,
  input: WorkspaceTargetInput,
  access: FileAccess,
) => {
  const target = await resolveLocalWorkspaceTarget(deps, input, "file");
  const files = target.workspace.provider_capabilities_json?.files;
  if (files === "none" || (access === "write" && files && files !== "write"))
    throw new Error(`Workspace provider does not allow file ${access} access.`);
  return target.root;
};

export const createWorkspaceFileMount = (
  resolvePath: (access: FileAccess) => Promise<string>,
  signal?: AbortSignal,
  translatePath: (path: string) => string | Promise<string> = (path) => path,
): ArtifactMount => {
  const mount = async (access: FileAccess) =>
    createFileMount(
      access === "read" ? await createReadBoundary(signal)(() => resolvePath(access)) : await resolvePath(access),
      signal,
    );
  const list: ArtifactMount["list"] = async (path) => {
    const translated = path === undefined ? undefined : await translatePath(path);
    const files = await (await mount("read")).list(translated);
    if (path === undefined || translated === undefined) return files;
    return files.map((file) => ({ ...file, path: restoreAliasPath(path, translated, file.path) }));
  };
  const listDirs: ArtifactMount["listDirs"] = async (path) => {
    const translated = path === undefined ? undefined : await translatePath(path);
    const directories = await (await mount("read")).listDirs(translated);
    if (path === undefined || translated === undefined) return directories;
    return directories.map((directory) => restoreAliasPath(path, translated, directory));
  };
  return {
    exists: async (path) => (await mount("read")).exists(await translatePath(path)),
    readText: async (path) => (await mount("read")).readText(await translatePath(path)),
    readBytes: async (path) => (await mount("read")).readBytes(await translatePath(path)),
    list,
    listDirs,
    writeText: async (path, value) => (await mount("write")).writeText(await translatePath(path), value),
    updateText: async (path, value) => (await mount("write")).updateText(await translatePath(path), value),
    writeBytes: async (path, value) => (await mount("write")).writeBytes(await translatePath(path), value),
    delete: async (path) => (await mount("write")).delete(await translatePath(path)),
  };
};
