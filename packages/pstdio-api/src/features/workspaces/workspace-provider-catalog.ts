import type { WorkspaceProviderDescriptor } from "pstdio-api-contracts";
import type { WorkspacesRouteDeps } from "./deps";
import { worktreeProviderId } from "./workspace-provider-identity";
import { hasUsableGitBase } from "./worktree-setup";

export const listWorkspaceProviders = async (deps: WorkspacesRouteDeps, projectId: string) => {
  const home = await deps.workspaceService.getDefault(projectId);
  const providers: WorkspaceProviderDescriptor[] = [];
  if (home?.execution_kind === "local" && home.root_path && (await hasUsableGitBase(home.root_path))) {
    providers.push({
      id: worktreeProviderId,
      label: "Git worktree",
      description:
        "Create an isolated branch. Git review and merge cover the entire repository, including paths outside the project folder.",
      params: { base: { type: "text", label: "Base revision", defaultValue: "HEAD", required: true } },
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
