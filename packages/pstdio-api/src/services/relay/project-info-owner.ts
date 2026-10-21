import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { readGitRemote } from "../../features/projects/git-remote";

/**
 * Runs after the project info are fully downloaded, so a local value never hides a remote one.
 * The device adopts the synced name, and fills in a name or git remote the info still lacks.
 */
export const reconcileProjectInfo = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const project = await deps.projectService.get(projectId);
  if (!project) return;
  const info = await deps.projectInfoService.read(projectId);
  if (info.name && info.name !== project.name) await deps.projectService.update(projectId, { name: info.name });
  const folder = (await deps.workspaceService.getDefault(projectId))?.root_path;
  const gitRemote = info.gitRemote || !folder ? undefined : await readGitRemote(folder);
  if (!info.name || gitRemote)
    await deps.projectInfoService.write(projectId, { name: info.name ? undefined : project.name, gitRemote });
};
