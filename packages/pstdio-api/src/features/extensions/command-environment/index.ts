import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type { ExtensionProjectContext } from "pstdio-api-contracts/extension-kernel";
import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import {
  type CommandRunnerEnvironment,
  createReadBoundary,
  createWorkspaceFilesMount,
  ExtensionStorageConflictError,
  type InvocationScope,
  migrateExtensionStorage,
  type RuntimeArtifactMount,
  type RuntimeExtensionSettingRecord,
  resolveReadExtensionStoragePath,
  type ScopedHostApis,
} from "pstdio-extensions";
import { resolvePstdioHome } from "pstdio-paths";
import { apiLogger } from "../../../lib/logger";
import { runWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "../deps";
import { createExtensionConnectionsApi } from "../extension-connection-service";
import { findFreePort } from "../extension-process-api";
import { createAccountApi } from "./account";
import { createActivityApi } from "./activity";
import { createArtifactsApi } from "./artifacts";
import { createAutomationApi } from "./automation";
import { createExtensionFilesApi } from "./extension-files";
import { createFilesApi } from "./files";
import { createNotifyApi } from "./notifications";
import { createExtensionPackageFilesApi } from "./package-files";
import { createResourcesApi } from "./resources";
import { createScopedHostApis } from "./scoped-host-apis";
import { createSettingsApi } from "./settings";
import { createStorageApi } from "./storage";
import { type CommandEnvironmentRuntimeDeps, type EnabledSource, findEnabledSource } from "./types";
import { createViewsApi } from "./views";

import { createWorkspaceFileMount, type FileAccess, resolveWorkspaceFilesPath } from "./workspace-files";

const workspaceSyncStateRoot = (input: { projectId: string; workspaceDir: string; workspaceId?: string }) => {
  const key = createHash("sha256")
    .update(JSON.stringify([input.projectId, input.workspaceId ?? null, resolve(input.workspaceDir)]))
    .digest("hex");
  return join(resolvePstdioHome({ env: process.env }), "state", "workspace-files", key);
};

// syncDir cannot return what it kept, so the host log is where a user finds files that stopped updating.
const logKeptWorkspaceFile =
  (extensionId: string, workspaceDir: string) => (file: { path: string; reason: "unmanaged" | "edited" }) => {
    const path = join(workspaceDir, ...file.path.split("/"));
    apiLogger.warn(
      { event: "extension.workspace_sync.kept_file", extensionId, path, reason: file.reason },
      `Kept ${path} because Prompt Studio did not write its current content. Edit the source instead, or delete the file to get the current version.`,
    );
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
    settings?: RuntimeExtensionSettingRecord[];
    workspaceDir?: string;
    workspaceId?: string;
  },
  runtimeDeps: CommandEnvironmentRuntimeDeps = { setupWorkspaceWorktree, runWorkspaceProvisioning },
): CommandRunnerEnvironment => {
  const enabledSource = findEnabledSource(enabledSources, input.extensionId);
  if (!enabledSource) throw new Error(`Enabled extension instance not found: ${input.extensionId}`);

  const terminal = deps.terminal;
  const connections = createExtensionConnectionsApi(deps.extensionConnectionService, {
    projectId: input.projectId,
    extensionId: input.extensionId,
  });
  const manifest = (enabledSource.installedSource.manifest_json ?? {}) as {
    pstdio?: { projectFiles?: { tracked?: boolean } };
  };
  const storageOwners = enabledSources.map(({ installedSource }) => ({
    extensionId: installedSource.extension_id,
    name: installedSource.extension_id.split(".")[1]!,
  }));
  // A storage conflict fails only writes into the conflicted extension's own storage. Other
  // writes, such as project files or harness skill syncs, must not depend on it.
  const prepareStorageRoot = async (root: string, access: FileAccess, ownStorage = false) => {
    if (access !== "write") return root;
    await migrateExtensionStorage(root, storageOwners).catch((error) => {
      const conflicted = error instanceof ExtensionStorageConflictError;
      if (!conflicted || (ownStorage && error.extensionIds.includes(input.extensionId))) throw error;
      apiLogger.warn(
        { err: error, event: "extensions.storage_migration.failed", extension_id: input.extensionId },
        "Extension storage migration needs attention",
      );
    });
    return root;
  };

  const scopedHostApis = (scope?: InvocationScope) => {
    const signal = scope?.signal;
    const provisioningWorkspaceId = input.eventId === workspaceEvents.provision.id ? input.workspaceId : undefined;
    const resolveWorkingPath = async (access: FileAccess) =>
      prepareStorageRoot(
        await resolveWorkspaceFilesPath(
          deps,
          {
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            provisioningWorkspaceId,
            eventId: input.eventId,
          },
          access,
        ),
        access,
      );
    const workingFiles = input.workspaceDir
      ? createWorkspaceFilesMount(input.workspaceDir, {
          signal,
          syncStateRoot: workspaceSyncStateRoot({ ...input, workspaceDir: input.workspaceDir }),
          onKeptFile: logKeptWorkspaceFile(input.extensionId, input.workspaceDir),
        })
      : undefined;

    const resolveProjectPath = async (access: FileAccess, ownStorage = false) =>
      prepareStorageRoot(
        await resolveWorkspaceFilesPath(deps, { projectId: input.projectId, provisioningWorkspaceId }, access),
        access,
        ownStorage,
      );
    const resolveOwnStoragePath = (access: FileAccess) => resolveProjectPath(access, true);
    const storage = createStorageApi(deps, {
      extensionId: input.extensionId,
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
      artifacts: createArtifactsApi(
        resolveOwnStoragePath,
        {
          ...input,
          onWrite: (path) => deps.artifactMountWrites.record(path),
          signal,
        },
        deps,
      ),
      projectFiles: createWorkspaceFileMount(resolveProjectPath, signal, async (path) =>
        resolveReadExtensionStoragePath(await resolveProjectPath("read"), path, storageOwners),
      ),
      workspaceFiles:
        input.workspaceId && workingFiles
          ? {
              ...createWorkspaceFileMount(resolveWorkingPath, signal, async (path) =>
                resolveReadExtensionStoragePath(await resolveWorkingPath("read"), path, storageOwners),
              ),
              syncDir: async (dir, files) => {
                const workspaceDir = await resolveWorkingPath("write");
                return createWorkspaceFilesMount(workspaceDir, {
                  syncStateRoot: workspaceSyncStateRoot({ ...input, workspaceDir }),
                  onKeptFile: logKeptWorkspaceFile(input.extensionId, workspaceDir),
                }).syncDir(dir, files);
              },
            }
          : workingFiles,
      packageFiles: createExtensionPackageFilesApi(enabledSource.installedSource.source_path, signal),
      extensionFiles: createExtensionFilesApi({
        name: input.name,
        extensionId: input.extensionId,
        signal,
        resolveRepoPath: resolveOwnStoragePath,
        tracked: manifest.pstdio?.projectFiles?.tracked === true,
      }),
      files: createFilesApi(deps, input.projectId, signal),
      skills: { list: () => createReadBoundary(signal)(() => deps.skillService.list(input.projectId)) },
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
    views: createViewsApi(deps, input),
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
    account: createAccountApi(deps.accountService, input.projectId),
    withScope: (scope) => scopedHostApis(scope),
  };
};
