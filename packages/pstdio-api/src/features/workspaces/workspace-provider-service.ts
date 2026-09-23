import { realpath, stat } from "node:fs/promises";
import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { provisionProviderWorkspace } from "./workspace-provider-creation";
import {
  isBuiltInProviderId,
  remoteReadOnlyCapabilities,
  rootProviderId,
  worktreeProviderId,
} from "./workspace-provider-identity";
import type { WorkspaceRecord } from "./workspace-provider-projection";
import { setupWorkspaceWorktree } from "./worktree-setup";

export { resolveWorkspaceExecutionTarget } from "./workspace-provider-execution-target";
export { normalizeResult } from "./workspace-provider-result";
export { isBuiltInProviderId, remoteReadOnlyCapabilities, rootProviderId, worktreeProviderId };

export class WorkspaceSourceNotFoundError extends Error {}

export const canonicalFolder = async (path: unknown) => {
  if (typeof path !== "string" || !path.trim()) throw new Error("Select a project folder.");
  const canonical = await realpath(path);
  if (!(await stat(canonical)).isDirectory()) throw new Error("Select an existing directory.");
  return canonical;
};

export const createProviderBackedWorkspace = async (
  deps: WorkspacesRouteDeps,
  input: {
    projectId: string;
    shorthandBase?: string;
    name?: string;
    anchors?: WorkspaceRecord["anchors_json"];
    providerId: string;
    params?: JsonObject;
    isDefault?: boolean;
    standalone?: boolean;
    setupWorktree?: typeof setupWorkspaceWorktree;
    provision?: (workspace: WorkspaceRecord, projectPath: string) => Promise<WorkspaceRecord>;
    signal?: AbortSignal;
  },
) => {
  const providerId = input.providerId;
  const params = input.params ?? {};
  const home = await deps.workspaceService.getDefault(input.projectId);
  if (providerId === rootProviderId && !input.isDefault) {
    if (home) return home;
    throw new WorkspaceSourceNotFoundError("The project has no default workspace.");
  }
  let sourcePath: string | null = null;
  if (providerId === rootProviderId) sourcePath = await canonicalFolder(params.path);
  if (providerId === worktreeProviderId) {
    if (!home?.root_path || home.execution_kind !== "local") {
      throw new WorkspaceSourceNotFoundError("A local project folder is required for a Git workspace.");
    }
    sourcePath = home.root_path;
  }
  const operationId = crypto.randomUUID();
  const createInput = {
    project_id: input.projectId,
    name: input.name,
    provider_id: providerId,
    provider_params_json: params,
    provider_state: "provisioning" as const,
    provider_operation_id: operationId,
    provider_operation_kind: "create" as const,
  };
  const createWorkspace = async () => {
    if (input.isDefault && home && !home.root_path && !home.provider_ref_json) {
      const attached = await deps.workspaceService.attachInitialProvider(home.id, {
        provider_id: providerId,
        provider_params_json: params,
        root_path: sourcePath ?? undefined,
        provider_operation_id: operationId,
      });
      if (!attached) throw new Error("The project already has an initial workspace.");
      return attached;
    }
    if (input.isDefault)
      return deps.workspaceService.ensureDefault({
        ...createInput,
        name: input.name ?? "Project folder",
        root_path: sourcePath ?? undefined,
      });
    if (input.standalone) return deps.workspaceService.createStandalone(createInput);
    return deps.workspaceService.create({
      ...createInput,
      shorthand_base: input.shorthandBase ?? "",
      anchors: input.anchors,
    });
  };
  const workspace = await createWorkspace();
  if (isBuiltInProviderId(providerId) && (input.isDefault || input.provision)) {
    await deps.workspaceService.setInitializing(workspace.id, true);
  }
  const updated = await provisionProviderWorkspace(deps, {
    operationId: workspace.provider_operation_id ?? operationId,
    projectId: input.projectId,
    providerId,
    params,
    sourcePath,
    setupWorktree: input.setupWorktree ?? setupWorkspaceWorktree,
    signal: input.signal,
    workspace,
  });
  const projectPath = home?.root_path ?? updated.root_path;
  if (
    input.provision &&
    updated.provider_state === "ready" &&
    updated.execution_kind === "local" &&
    updated.root_path &&
    projectPath
  ) {
    return input.provision(updated, projectPath);
  }
  return updated;
};
