import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { initialWorkspaceSchema } from "pstdio-api-contracts";
import { resolvePstdioHome } from "pstdio-paths";
import { rootProviderId } from "../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "./deps";
import { initializeProjectWorkspace, withFolderCreation } from "./project-folder";

export const openProject = (deps: ProjectsRouteDeps, projectId: string) =>
  withFolderCreation(`project-folder:${projectId}`, async () => {
    let workspace = await deps.workspaceService.getDefault(projectId);
    // An explicit provider binding belongs to its provider, including remote workspaces.
    if (workspace?.provider_id !== rootProviderId && workspace?.provider_id) return workspace;
    if (!workspace?.root_path) {
      const sync = await deps.accountService.projectSyncStatus(projectId);
      if (sync.state !== "local" && !sync.offlineReady)
        throw new Error("Project content has not finished downloading. Retry opening the project after download.");
      const path = join(resolvePstdioHome(), "projects", `project-${encodeURIComponent(projectId)}`);
      await mkdir(path, { recursive: true });
      const canonical = await realpath(path);
      return withFolderCreation(canonical, async () => {
        const owner = await deps.workspaceService.findByPath(canonical);
        if (owner && (owner.project_id !== projectId || !owner.is_default))
          throw new Error("This folder already belongs to another workspace.");
        workspace = await initializeProjectWorkspace(deps, projectId, {
          provider_id: rootProviderId,
          params: { path: canonical },
        });
        return requireReady(workspace);
      });
    }
    if (workspace.setup_error || workspace.initializing || workspace.provider_state !== "ready")
      workspace = await initializeProjectWorkspace(deps, projectId, {
        provider_id: workspace.provider_id,
        params: initialWorkspaceSchema.parse({
          provider_id: workspace.provider_id,
          params: workspace.provider_params_json,
        }).params,
      });
    return requireReady(workspace);
  });

const requireReady = (
  workspace: NonNullable<Awaited<ReturnType<ProjectsRouteDeps["workspaceService"]["getDefault"]>>>,
) => {
  if (workspace.setup_error) throw new Error(workspace.setup_error);
  if (workspace.initializing || workspace.provider_state !== "ready")
    throw new Error("The project folder is still being prepared. Retry opening the project.");
  return workspace;
};
