import { mkdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount, type InvocationScope } from "pstdio-extensions";
import type { WorkspacesRouteDeps } from "./deps";
import { canonicalWorkspacePath, managedWorkspacesRoot } from "./workspace-directory-paths";

export const createWorkspaceProviderDirectory = (
  deps: Pick<WorkspacesRouteDeps, "workspaceService">,
  input: { projectId: string; providerId: string; workspaceId: string },
  scope?: InvocationScope,
) => {
  let closed = false;
  scope?.register(() => {
    closed = true;
  });
  const signal = scope?.signal;
  const ensureActive = () => {
    signal?.throwIfAborted();
    if (closed) throw new Error("Workspace provider operation ended.");
  };
  return async () => {
    const assertOwned = async () => {
      ensureActive();
      const workspace = await deps.workspaceService.get(input.workspaceId);
      if (!workspace || workspace.deleted_at || workspace.project_id !== input.projectId)
        throw new Error("Workspace provider does not own this workspace.");
      if (workspace.is_default) throw new Error("Default workspace directories are protected.");
      if (workspace.provider_id !== input.providerId)
        throw new Error("Workspace provider does not own this workspace.");
      if (!workspace.id || basename(workspace.id) !== workspace.id || [".", ".."].includes(workspace.id))
        throw new Error("Workspace has no valid owned directory.");
      ensureActive();
    };
    await assertOwned();
    const root = resolve(managedWorkspacesRoot());
    const path = join(root, input.workspaceId);
    const assertPath = async () => {
      const expected = join(await canonicalWorkspacePath(root), input.workspaceId);
      if ((await canonicalWorkspacePath(path)) !== expected)
        throw new Error("Workspace path does not resolve to its owned directory.");
      ensureActive();
    };
    await mkdir(root, { recursive: true });
    await assertPath();
    await mkdir(path, { recursive: true });
    await assertPath();
    const canonicalPath = await canonicalWorkspacePath(path);
    ensureActive();
    const mount = createFileMount(canonicalPath, signal);
    const access = async <T>(operation: (files: ArtifactMount) => Promise<T>) => {
      await assertOwned();
      await assertPath();
      return operation(mount);
    };
    const files: ArtifactMount = {
      exists: (path) => access((files) => files.exists(path)),
      readText: (path) => access((files) => files.readText(path)),
      writeText: (path, value) => access((files) => files.writeText(path, value)),
      updateText: (path, value) => access((files) => files.updateText(path, value)),
      readBytes: (path) => access((files) => files.readBytes(path)),
      writeBytes: (path, value) => access((files) => files.writeBytes(path, value)),
      list: (pattern) => access((files) => files.list(pattern)),
      listDirs: (path) => access((files) => files.listDirs(path)),
      delete: (path) => access((files) => files.delete(path)),
    };
    return {
      path: canonicalPath,
      files,
      async remove() {
        await assertOwned();
        await assertPath();
        await rm(path, { recursive: true, force: true });
      },
    };
  };
};
