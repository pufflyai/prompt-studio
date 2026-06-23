import type { ExtensionWorkspace } from "pstdio-api-contracts/extension-kernel";
import { worktreeEvents } from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import { archiveWorkspaceCascade } from "../../workspaces/archive-workspace-cascade";
import type { ExtensionsRouteDeps } from "../deps";
import type { CommandEnvironmentRuntimeDeps } from "./types";

const resolveRepoForWorkspace = async (deps: ExtensionsRouteDeps, projectId: string, repoId: unknown) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) throw new Error(`Repo not found for project ${projectId}`);
  if (typeof repoId === "string" && repoId.trim()) {
    const repo = repos.find((candidate) => candidate.id === repoId);
    if (!repo) throw new Error(`Repo not found: ${repoId}`);
    return repo;
  }
  return repos[0]!;
};

export const createExtensionWorkspace = async (
  deps: ExtensionsRouteDeps,
  input: {
    projectId: string;
    workspaceInput: Record<string, unknown>;
  },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
) => {
  const projectId =
    typeof input.workspaceInput.project_id === "string" ? input.workspaceInput.project_id : input.projectId;
  const anchors = Array.isArray(input.workspaceInput.anchors) ? (input.workspaceInput.anchors as never[]) : [];
  const shorthandBase =
    typeof input.workspaceInput.shorthand_base === "string" ? input.workspaceInput.shorthand_base : undefined;
  if (!shorthandBase) throw new Error("Workspace creation requires shorthand_base");

  const mode = input.workspaceInput.mode === "current_branch" ? "current_branch" : "worktree";
  const repo = await resolveRepoForWorkspace(deps, projectId, input.workspaceInput.repo_id);
  const workspace = await deps.workspaceService.create({
    project_id: projectId,
    shorthand_base: shorthandBase,
    anchors,
  });

  if (mode === "current_branch") {
    const updated =
      (await deps.workspaceService.updateGitMetadata(workspace.id, {
        branch: null,
        worktree_path: repo.path,
      })) ?? workspace;
    return updated;
  }

  try {
    const { branch, worktreePath } = await runtimeDeps.setupWorkspaceWorktree({
      repoPath: repo.path,
      workspaceShorthand: workspace.workspace_shorthand,
      base: typeof input.workspaceInput.base === "string" ? input.workspaceInput.base : "HEAD",
    });
    const updated =
      (await deps.workspaceService.updateGitMetadata(workspace.id, { branch, worktree_path: worktreePath })) ??
      workspace;
    // Mirror the standalone create-workspace endpoint so worktree-bootstrap hooks
    // (agent/.pstdio config copy) run for extension-created attempts too.
    runtimeDeps.fireExtensionEventAsync(deps, projectId, worktreeEvents.created, {
      projectId,
      repoPath: repo.path,
      worktreePath,
      branch,
      workspace: updated.workspace_shorthand,
      workspaceId: updated.id,
      anchors,
    });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = (await deps.workspaceService.setSetupError(workspace.id, message)) ?? workspace;
    return failed;
  }
};

export const createWorkspacesApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string },
  runtimeDeps: CommandEnvironmentRuntimeDeps,
): CommandRunnerEnvironment["workspaces"] => ({
  list: async () => (await deps.workspaceService.list(input.projectId)) as ExtensionWorkspace[],
  get: async (id) => (await deps.workspaceService.get(id)) as ExtensionWorkspace | null,
  getByShorthand: async (shorthand) =>
    (await deps.workspaceService.getByShorthand(input.projectId, shorthand)) as ExtensionWorkspace | null,
  create: async (workspaceInput) =>
    (await createExtensionWorkspace(
      deps,
      { projectId: input.projectId, workspaceInput },
      runtimeDeps,
    )) as ExtensionWorkspace,
  archive: async (id) => {
    const workspace = await deps.workspaceService.get(id);
    // Cascade archive: also archive the workspace's sessions and remove its worktree.
    if (workspace) await archiveWorkspaceCascade(deps, workspace);
  },
  delete: async (id) => {
    await deps.workspaceService.softDelete(id);
  },
});
