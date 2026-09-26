import type { ExtensionWorkspaceProvider } from "pstdio-api-contracts/extension-kernel";
import { git, listBranches } from "pstdio-wt";
import { apiLogger } from "../../lib/logger";
import type { WorkspacesRouteDeps } from "./deps";
import { worktreeProviderId } from "./workspace-provider-identity";
import { hasUsableGitBase } from "./worktree-setup";

const discoverGitProvider = async (path: string) => {
  try {
    if (!(await hasUsableGitBase(path))) return null;
    const branches = await listBranches(path);
    const currentBranch = await git(path, ["branch", "--show-current"]);
    const defaultValue = currentBranch ? (branches.find((branch) => branch.isCurrent)?.name ?? currentBranch) : "HEAD";
    const options = branches
      .filter((branch) => Boolean(currentBranch) || !branch.isCurrent)
      .map((branch) => ({ label: branch.name, value: branch.name, icon: "git-commit-horizontal" }));
    if (!currentBranch) {
      options.unshift({ label: "Current checkout (no branch)", value: "HEAD", icon: "git-commit-horizontal" });
    }
    return {
      id: worktreeProviderId,
      label: "Git worktree",
      icon: "git-branch",
      description: "Create an isolated branch in the project repository.",
      params: {
        base: { type: "select", label: "Base branch", required: true, defaultValue, options },
      },
    } satisfies ExtensionWorkspaceProvider;
  } catch (error) {
    apiLogger.warn({ err: error, root_path: path }, "Git workspace provider discovery failed");
    return null;
  }
};

export const listWorkspaceProviders = async (deps: WorkspacesRouteDeps, projectId: string) => {
  // The bridge creation service uses the first linked repository when no legacy repo_id is supplied.
  // Keep its branch choices tied to that same source until the single-folder host cutover.
  const [repository] = await deps.repoService.listByProject(projectId);
  const gitProvider = repository ? await discoverGitProvider(repository.path) : null;
  const providers: ExtensionWorkspaceProvider[] = gitProvider ? [gitProvider] : [];
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  for (const entry of snapshot.runtime.workspaceTypes) {
    providers.push({
      id: entry.id,
      label: entry.provider.label,
      icon: entry.provider.icon,
      description:
        "The provider supplies this environment and its files. Local files are not uploaded or synchronized.",
      params: entry.provider.params ?? {},
    });
  }
  return providers;
};
