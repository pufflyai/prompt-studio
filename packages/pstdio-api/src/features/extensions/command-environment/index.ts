import type {
  ExtensionProjectContext,
  RepoContext,
  TerminalSessionRequest,
} from "pstdio-api-contracts/extension-kernel";
import {
  type CommandRunnerEnvironment,
  createWorkspaceFilesMount,
  type RuntimeArtifactMount,
  type RuntimeExtensionSettingRecord,
} from "pstdio-extensions";
import { runWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "../deps";
import { createProcessApi, findFreePort } from "../extension-process-api";
import { createRepoFilesApi } from "../repo-files-api";
import { createActivityApi } from "./activity";
import { createArtifactsApi } from "./artifacts";
import { createFilesApi } from "./files";
import { createNotifyApi } from "./notifications";
import { createReposApi, resolveRegisteredRepoPath } from "./repos";
import { createSessionsApi } from "./sessions";
import { createSettingsApi } from "./settings";
import { createStorageApi } from "./storage";
import { type CommandEnvironmentRuntimeDeps, type EnabledSource, findEnabledSource } from "./types";
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
    workspaceDir?: string;
    workspaceId?: string;
  },
  runtimeDeps: CommandEnvironmentRuntimeDeps = { setupWorkspaceWorktree, runWorkspaceProvisioning },
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
  const hostTerminal = deps.terminal;
  const terminal =
    hostTerminal && input.workspaceDir
      ? {
          openSession: (request: TerminalSessionRequest) =>
            hostTerminal.openSession({ ...request, cwd: request.cwd ?? input.workspaceDir }),
        }
      : hostTerminal;

  return {
    project: input.project,
    workspaceId: input.workspaceId,
    storage,
    artifacts: createArtifactsApi(deps, input),
    repoFiles: input.repo
      ? createRepoFilesApi(() => resolveRegisteredRepoPath(deps, input.projectId, input.repo as RepoContext))
      : undefined,
    workspaceFiles: input.workspaceDir ? createWorkspaceFilesMount(input.workspaceDir) : undefined,
    files: createFilesApi(deps, input.projectId),
    skills: { list: () => deps.skillService.list(input.projectId) },
    templates: { get: (name) => deps.templateService.getWithContent(input.projectId, name) },
    sessions: createSessionsApi(deps, { projectId: input.projectId, project: input.project }),
    workspaces: createWorkspacesApi(deps, { projectId: input.projectId }, runtimeDeps),
    repos: createReposApi(deps, input.projectId),
    activity: createActivityApi(deps, { projectId: input.projectId, enabledSource }),
    notify: createNotifyApi(deps, { projectId: input.projectId, enabledSource }),
    process: createProcessApi(),
    net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
    terminal,
    settings,
  };
};
