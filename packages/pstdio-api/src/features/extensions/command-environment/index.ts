import type { ExtensionProjectContext, RepoContext } from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment, RuntimeArtifactMount, RuntimeExtensionSettingRecord } from "pstdio-extensions";
import { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "../deps";
// Deferred (runtime-only) use; event-runtime imports back from this module, so
// reading fireExtensionEventAsync at module-eval time can hit its temporal dead
// zone when event-runtime is the entry of the import cycle.
import { fireExtensionEventAsync } from "../extension-event-runtime";
import { createProcessApi, findFreePort } from "../extension-process-api";
import { createExtensionWorktreesApi } from "../extension-worktree-environment";
import { createRepoFilesApi } from "../repo-files-api";
import { createActivityApi } from "./activity";
import { createArtifactsApi } from "./artifacts";
import { createFilesApi } from "./files";
import { createNotifyApi } from "./notifications";
import { createReposApi, resolveRegisteredRepoPath } from "./repos";
import { createSessionsApi } from "./sessions";
import { createSettingsApi } from "./settings";
import { createStorageApi } from "./storage";
import { type EnabledSource, findEnabledSource } from "./types";
import { createWorkspacesApi } from "./workspaces";

export const createCommandEnvironment = (
  deps: ExtensionsRouteDeps,
  enabledSources: EnabledSource[],
  input: {
    artifactMounts?: RuntimeArtifactMount[];
    extensionId: string;
    name: string;
    project: ExtensionProjectContext;
    projectId: string;
    repo?: RepoContext;
    settings?: RuntimeExtensionSettingRecord[];
  },
  runtimeDeps = { setupWorkspaceWorktree, fireExtensionEventAsync },
): CommandRunnerEnvironment => {
  const enabledSource = findEnabledSource(enabledSources, input.extensionId);
  if (!enabledSource) throw new Error(`Enabled extension instance not found: ${input.extensionId}`);

  const storage = createStorageApi(deps, {
    extensionInstanceId: enabledSource.instance.id,
    projectId: input.projectId,
  });
  const settings = createSettingsApi(deps, {
    extensionId: input.extensionId,
    extensionInstanceId: enabledSource.instance.id,
    installedExtensionId: enabledSource.installedSource.id,
    settings: input.settings,
  });

  return {
    project: input.project,
    storage,
    artifacts: createArtifactsApi(deps, input),
    repoFiles: input.repo
      ? createRepoFilesApi(() => resolveRegisteredRepoPath(deps, input.projectId, input.repo as RepoContext))
      : undefined,
    files: createFilesApi(deps, input.projectId),
    sessions: createSessionsApi(deps, { projectId: input.projectId, project: input.project }),
    workspaces: createWorkspacesApi(deps, { projectId: input.projectId }, runtimeDeps),
    worktrees: createExtensionWorktreesApi(deps, { projectId: input.projectId }),
    repos: createReposApi(deps, input.projectId),
    activity: createActivityApi(deps, { projectId: input.projectId, enabledSource }),
    notify: createNotifyApi(deps, { projectId: input.projectId, enabledSource }),
    process: createProcessApi(),
    net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
    settings,
  };
};
