import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type {
  ExtensionProjectContext,
  RepoContext,
  TerminalSessionRequest,
} from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import {
  type CommandRunnerEnvironment,
  createReadBoundary,
  createWorkspaceFilesMount,
  type InvocationScope,
  type RuntimeArtifactMount,
  type RuntimeExtensionSettingRecord,
  type ScopedHostApis,
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
import { createProjectFilesApi } from "./project-files";
import { createReposApi, resolveRegisteredRepoPath } from "./repos";
import { createResourcesApi } from "./resources";
import { createScopedHostApis } from "./scoped-host-apis";
import { createSettingsApi } from "./settings";
import { createStorageApi } from "./storage";
import { type CommandEnvironmentRuntimeDeps, type EnabledSource, findEnabledSource } from "./types";

import { createWorkspaceFileMount, type FileAccess, resolveWorkspaceFilesPath } from "./workspace-files";

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
    eventId?: string;
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

  const hostTerminal = deps.terminal;
  const terminal =
    hostTerminal && input.workspaceDir && !input.workspaceId
      ? {
          openSession: (request: TerminalSessionRequest) =>
            hostTerminal.openSession({ ...request, cwd: request.cwd ?? input.workspaceDir }),
        }
      : hostTerminal;
  const connections = createExtensionConnectionsApi(deps.extensionConnectionService, {
    projectId: input.projectId,
    extensionId: input.extensionId,
  });
  const manifest = (enabledSource.installedSource.manifest_json ?? {}) as {
    pstdio?: { repoFiles?: { tracked?: boolean } };
  };

  const scopedHostApis = (scope?: InvocationScope) => {
    const signal = scope?.signal;
    const provisioningWorkspaceId = input.eventId === workspaceEvents.provision.id ? input.workspaceId : undefined;
    const resolveWorkingPath = (access: FileAccess) =>
      resolveWorkspaceFilesPath(
        deps,
        {
          projectId: input.projectId,
          workspaceId: input.workspaceId,
          provisioningWorkspaceId,
          eventId: input.eventId,
          repo: input.repo,
        },
        access,
      );
    const workingFiles = input.workspaceDir
      ? createWorkspaceFilesMount(input.workspaceDir, {
          signal,
          syncStateRoot: workspaceSyncStateRoot({ ...input, workspaceDir: input.workspaceDir }),
        })
      : undefined;

    const resolveRepoPath = (readSignal?: AbortSignal) =>
      resolveRegisteredRepoPath(deps, input.projectId, input.repo as RepoContext, readSignal);
    const storage = createStorageApi(deps, {
      extensionInstanceId: enabledSource.instance.id,
      projectId: input.projectId,
      signal,
    });
    const settings = createSettingsApi(deps, {
      extensionId: input.extensionId,
      extensionInstanceId: enabledSource.instance.id,
      installedExtensionId: enabledSource.installedSource.id,
      settings: input.settings,
      signal,
    });

    return {
      storage,
      artifacts: createArtifactsApi(deps, { ...input, signal }),
      repoFiles: input.repo ? createRepoFilesApi(resolveRepoPath, signal) : undefined,
      projectFiles: createProjectFilesApi(deps, input.projectId, provisioningWorkspaceId, signal),
      workspaceFiles:
        input.workspaceId && workingFiles
          ? {
              ...createWorkspaceFileMount(resolveWorkingPath, signal),
              syncDir: async (dir, files) => {
                const workspaceDir = await resolveWorkingPath("write");
                return createWorkspaceFilesMount(workspaceDir, {
                  syncStateRoot: workspaceSyncStateRoot({ ...input, workspaceDir }),
                }).syncDir(dir, files);
              },
            }
          : workingFiles,
      packageFiles: createExtensionPackageFilesApi(enabledSource.installedSource.source_path, signal),
      extensionFiles: input.repo
        ? createExtensionFilesApi({
            extensionId: input.extensionId,
            signal,
            resolveRepoPath,
            tracked: manifest.pstdio?.repoFiles?.tracked === true,
          })
        : undefined,
      files: createFilesApi(deps, input.projectId, signal),
      skills: { list: () => createReadBoundary(signal)(() => deps.skillService.list(input.projectId)) },
      repos: createReposApi(deps, input.projectId, signal),
      settings,
      ...createScopedHostApis(deps, input, { connections, terminal }, runtimeDeps, scope),
    } satisfies ScopedHostApis;
  };
  const hostApis = scopedHostApis();
  return {
    project: input.project,
    workspaceId: input.workspaceId,
    ...hostApis,
    resources: createResourcesApi(deps, input),
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
    withScope: (scope) => scopedHostApis(scope),
  };
};
