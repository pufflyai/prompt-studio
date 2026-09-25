import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type {
  ExtensionProjectContext,
  RepoContext,
  TerminalSessionRequest,
} from "pstdio-api-contracts/extension-kernel";
import {
  type CommandRunnerEnvironment,
  createWorkspaceFilesMount,
  type InvocationScope,
  type RuntimeArtifactMount,
  type RuntimeExtensionSettingRecord,
} from "pstdio-extensions";
import { resolvePstdioHome } from "pstdio-paths";
import { runWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "../deps";
import { createExtensionConnectionsApi } from "../extension-connection-service";
import { findFreePort } from "../extension-process-api";
import { createRepoFilesApi } from "../repo-files-api";
import { createActivityApi } from "./activity";
import { createArtifactsApi } from "./artifacts";
import { createAutomationApi } from "./automation";
import { createExtensionFilesApi } from "./extension-files";
import { createFilesApi } from "./files";
import { createNotifyApi } from "./notifications";
import { createExtensionPackageFilesApi } from "./package-files";
import { createReposApi, resolveRegisteredRepoPath } from "./repos";
import { createResourcesApi } from "./resources";
import { createScopedHostApis } from "./scoped-host-apis";
import { createSettingsApi } from "./settings";
import { createStorageApi } from "./storage";
import { type CommandEnvironmentRuntimeDeps, type EnabledSource, findEnabledSource } from "./types";

const workspaceSyncStateRoot = (input: { projectId: string; workspaceDir: string; workspaceId?: string }) => {
  const key = createHash("sha256")
    .update(JSON.stringify([input.projectId, input.workspaceId ?? null, resolve(input.workspaceDir)]))
    .digest("hex");
  return join(resolvePstdioHome({ env: process.env }), "state", "workspace-files", key);
};

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
  const connections = createExtensionConnectionsApi(deps.extensionConnectionService, {
    projectId: input.projectId,
    extensionId: input.extensionId,
  });
  const scopedHostApis = (scope?: InvocationScope) =>
    createScopedHostApis(deps, input, { connections, terminal }, runtimeDeps, scope);
  const hostApis = scopedHostApis();
  const resolveRepoPath = () => resolveRegisteredRepoPath(deps, input.projectId, input.repo as RepoContext);
  const manifest = (enabledSource.installedSource.manifest_json ?? {}) as {
    pstdio?: { repoFiles?: { tracked?: boolean } };
  };

  return {
    project: input.project,
    workspaceId: input.workspaceId,
    storage,
    resources: createResourcesApi(deps, input),
    artifacts: createArtifactsApi(deps, input),
    repoFiles: input.repo ? createRepoFilesApi(resolveRepoPath) : undefined,
    workspaceFiles: input.workspaceDir
      ? createWorkspaceFilesMount(input.workspaceDir, {
          syncStateRoot: workspaceSyncStateRoot({ ...input, workspaceDir: input.workspaceDir }),
        })
      : undefined,
    packageFiles: createExtensionPackageFilesApi(enabledSource.installedSource.source_path),
    extensionFiles: input.repo
      ? createExtensionFilesApi({
          extensionId: input.extensionId,
          resolveRepoPath,
          tracked: manifest.pstdio?.repoFiles?.tracked === true,
        })
      : undefined,
    files: createFilesApi(deps, input.projectId),
    skills: { list: () => deps.skillService.list(input.projectId) },
    sessions: hostApis.sessions,
    workspaces: hostApis.workspaces,
    repos: createReposApi(deps, input.projectId),
    activity: createActivityApi(deps, { projectId: input.projectId, enabledSource }),
    notify: createNotifyApi(deps, { projectId: input.projectId, enabledSource }),
    automation: createAutomationApi(() => deps.automationService, {
      projectId: input.projectId,
      extensionId: input.extensionId,
    }),
    process: hostApis.process,
    net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
    connections: hostApis.connections,
    terminal: hostApis.terminal,
    settings,
    withScope: (scope) => scopedHostApis(scope),
  };
};
