import type { ExtensionWorkspaceProvider } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { worktreeProviderId } from "./workspace-provider-identity";
import { hasUsableGitBase } from "./worktree-setup";

export const listWorkspaceProviders = async (deps: WorkspacesRouteDeps, projectId: string) => {
  const repositories = await deps.repoService.listByProject(projectId);
  const usable = (
    await Promise.all(repositories.map(async (repo) => ((await hasUsableGitBase(repo.path)) ? repo : null)))
  ).filter((repo) => repo !== null);
  const providers: ExtensionWorkspaceProvider[] = [];
  if (usable.length) {
    providers.push({
      id: worktreeProviderId,
      label: "Git worktree",
      description: "Create an isolated branch in the project repository.",
      params: {
        repo_id: {
          type: "select",
          label: "Repository",
          required: true,
          defaultValue: usable[0].id,
          options: usable.map((repo) => ({ label: repo.name, value: repo.id })),
        },
        base: { type: "text", label: "Base revision", defaultValue: "HEAD", required: true },
      },
    });
  }
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  for (const entry of snapshot.runtime.workspaceTypes) {
    providers.push({
      id: entry.id,
      label: entry.provider.label,
      description:
        "The provider supplies this environment and its files. Local files are not uploaded or synchronized.",
      params: entry.provider.params ?? {},
    });
  }
  return providers;
};
