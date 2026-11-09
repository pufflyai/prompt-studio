import { mkdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount, type InvocationScope } from "pstdio-extensions";
import type { WorkspacesRouteDeps } from "./deps";
import { canonicalWorkspacePath, managedWorkspacesRoot } from "./workspace-directory-paths";

const directoryOwners = new Map<string, { active: Set<InvocationScope>; removing: boolean }>();
const directoryOwner = (workspaceId: string) => {
  let owner = directoryOwners.get(workspaceId);
  if (!owner) {
    owner = { active: new Set(), removing: false };
    directoryOwners.set(workspaceId, owner);
  }
  return owner;
};
const releaseDirectoryOwner = (workspaceId: string, owner: ReturnType<typeof directoryOwner>) => {
  if (!owner.removing && !owner.active.size) directoryOwners.delete(workspaceId);
};

export const createWorkspaceProviderDirectory = (
  deps: Pick<WorkspacesRouteDeps, "workspaceService">,
  input: { projectId: string; providerId: string; workspaceId: string },
  scope?: InvocationScope,
) => {
  let closed = false;
  if (scope) {
    scope.signal.throwIfAborted();
    const owner = directoryOwner(input.workspaceId);
    if (owner.removing) throw new Error("Workspace directory cleanup is active.");
    if (owner.active.has(scope))
      scope.register(() => {
        closed = true;
      });
    else {
      owner.active.add(scope);
      scope.register(() => {
        closed = true;
        owner.active.delete(scope);
        releaseDirectoryOwner(input.workspaceId, owner);
      });
    }
  }
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

export const removeInactiveWorkspaceProviderDirectory = async (
  deps: Pick<WorkspacesRouteDeps, "workspaceService">,
  input: { projectId: string; providerId: string; workspaceId: string },
  operationId: string,
) => {
  const owner = directoryOwner(input.workspaceId);
  if (owner.removing || owner.active.size) throw new Error("Workspace directory has active provider ownership.");
  owner.removing = true;
  try {
    const current = await deps.workspaceService.get(input.workspaceId);
    if (
      !current ||
      current.provider_operation_id !== operationId ||
      current.provider_operation_kind !== "delete" ||
      current.provider_ref_json
    )
      throw new Error("Workspace cleanup operation changed before directory removal.");
    await (await createWorkspaceProviderDirectory(deps, input)()).remove();
  } finally {
    owner.removing = false;
    releaseDirectoryOwner(input.workspaceId, owner);
  }
};
