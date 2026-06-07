import { setupWorkspaceWorktree } from "../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "./deps";

type WorkspaceRuntimeDeps = Pick<ExtensionsRouteDeps, "eventBus" | "repoService" | "workspaceService">;

const stringInput = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const resolveStandaloneWorkspaceRepo = async (
  deps: Pick<ExtensionsRouteDeps, "repoService">,
  projectId: string,
  input: Record<string, unknown>,
) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return null;

  const repoId = stringInput(input, "repo_id") ?? stringInput(input, "repoId");
  if (repoId) return repos.find((repo) => repo.id === repoId) ?? null;

  const repoPath = stringInput(input, "repo_path") ?? stringInput(input, "repoPath");
  if (repoPath) return repos.find((repo) => repo.path === repoPath) ?? null;

  return repos[0] ?? null;
};

export const createStandaloneExtensionWorkspace = async (
  deps: WorkspaceRuntimeDeps,
  projectId: string,
  input: Record<string, unknown>,
) => {
  const workspaceProjectId = stringInput(input, "project_id") ?? projectId;
  const repo = await resolveStandaloneWorkspaceRepo(deps, workspaceProjectId, input);
  if (!repo) throw new Error(`No repository found for project ${workspaceProjectId}`);

  const name = stringInput(input, "name");
  const workspace = await deps.workspaceService.createStandalone({
    project_id: workspaceProjectId,
    ...(name ? { name } : {}),
  });
  const base = stringInput(input, "base") ?? stringInput(input, "branch") ?? "HEAD";

  try {
    const { branch, worktreePath } = await setupWorkspaceWorktree({
      repoPath: repo.path,
      workspaceShorthand: workspace.workspace_shorthand,
      base,
    });
    const updated =
      (await deps.workspaceService.updateGitMetadata(workspace.id, { branch, worktree_path: worktreePath })) ??
      workspace;
    deps.eventBus.emit("workspaces", "set", updated);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = (await deps.workspaceService.setSetupError(workspace.id, message)) ?? workspace;
    deps.eventBus.emit("workspaces", "set", failed);
    return failed;
  }
};
