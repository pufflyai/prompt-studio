import type {
  InstallExtensionRequest,
  ProjectExtensionInstance,
  UploadExtensionRequest,
  WorkbenchExtensionAutomationRecord,
} from "pstdio-api-contracts";
import { canonicalRuntimeId } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { ExtensionUpgradeUnavailableError } from "../../services/extension-upgrade-unavailable-error";
import type { RouteDeps } from "../deps";
import { provisionProjectWorkspaces } from "../workspaces/provision-coordinator";
import { legacyGitProviderId, runtimeProviderId, worktreeProviderId } from "../workspaces/workspace-provider-identity";
import { reconcileProviderWorkspaces } from "../workspaces/workspace-provider-reconciliation";
import { findWorkspaceProviderRecord } from "../workspaces/workspace-provider-runtime";
import { adoptWorkspacesTool } from "./adopt-workspaces-tool";
import type { ExtensionsRouteDeps } from "./deps";
import { setDeviceAutomationEnabled } from "./device-automations";
import { findExtensionCatalogEntry } from "./extension-catalog";
import { extensionChangesWorkspaceProvisioning } from "./extension-skill-cleanup";
import { toExtensionEnableInput } from "./install-extension-source";
import { withProjectExtensionChoices } from "./project-extension-choices";
import { toProjectExtensionInstance } from "./project-extension-instance";
import { openPublishedCatalog } from "./publication/catalog";
import { removeSharedSelection, shareEnabledChoice } from "./publication/change-catalog";
import { selectPublicationSource } from "./publication/prepare-activation";

type LifecycleDeps = ExtensionsRouteDeps & {
  installedExtensionSourcesService: RouteDeps["installedExtensionSourcesService"];
  provisionProjectWorkspaces?: typeof provisionProjectWorkspaces;
};

export type ProjectExtensionLifecycle = ReturnType<typeof createProjectExtensionLifecycle>;

export type ProjectExtensionLifecycleRouteDeps = ExtensionsRouteDeps & {
  projectExtensionLifecycle: ProjectExtensionLifecycle;
};

export class ExtensionProviderInUseError extends Error {}

const extensionProviderWorkspaces = async (deps: LifecycleDeps, projectId: string, extensionId: string) => {
  const prefix = `${extensionId}.workspace-type.`;
  const workspaces = await deps.workspaceService.listForProviderReconciliation(projectId);
  const legacyProvider =
    extensionId === "pstdio.git-workspaces" &&
    workspaces.some((workspace) => [worktreeProviderId, legacyGitProviderId].includes(workspace.provider_id));
  // The legacy provider and its successor share public IDs. Resolve that handoff
  // only when those workspaces exist; ordinary removal needs no project runtime.
  const runtime = legacyProvider ? (await deps.extensionRuntimeCatalog.get(projectId)).runtime : undefined;
  return workspaces.filter((workspace) => {
    const provider = runtime && findWorkspaceProviderRecord(runtime, workspace.provider_id);
    if (provider) return provider.extensionId === extensionId;
    // Provider IDs identify their owner without loading every tool in the project.
    // A suspended runtime read must not prevent removing an unrelated tool.
    // A disabled predecessor still owns its checkouts until an active successor takes over.
    if (
      extensionId === "pstdio.git-workspaces" &&
      [worktreeProviderId, legacyGitProviderId].includes(workspace.provider_id)
    )
      return true;
    return runtimeProviderId(workspace.provider_id).startsWith(prefix);
  });
};

const refreshProviderWorkspaces = async (deps: LifecycleDeps, projectId: string, extensionId: string) => {
  if ((await extensionProviderWorkspaces(deps, projectId, extensionId)).length)
    await reconcileProviderWorkspaces(deps, projectId);
};

export const completeProjectExtensionInstallation = async (
  deps: LifecycleDeps,
  projectId: string,
  installName: string,
) => {
  const enabled = (await deps.extensionService.listProjectExtensionInstances(projectId)).filter(
    (record) => record.instance.enabled,
  );
  let selected = enabled.find((record) => record.installedSource.install_name === installName);
  if (!selected) {
    const catalog = await findExtensionCatalogEntry(installName);
    const extensionId = catalog?.extensionId ?? `pstdio.${installName}`;
    selected = enabled.find((record) => record.installedSource.extension_id === extensionId);
  }
  if (selected && (await extensionChangesWorkspaceProvisioning(deps, selected.installedSource)))
    await (deps.provisionProjectWorkspaces ?? provisionProjectWorkspaces)(deps, projectId);
  if (selected) await refreshProviderWorkspaces(deps, projectId, selected.installedSource.extension_id);
  if (selected?.installedSource.extension_id === "pstdio.workspaces") await adoptWorkspacesTool(deps, projectId);
};

export const createProjectExtensionLifecycle = (deps: LifecycleDeps) => {
  const changesWorkspaceProvisioning = (
    installedSource: Awaited<ReturnType<LifecycleDeps["extensionService"]["getInstalledSource"]>>,
  ) => {
    if (!installedSource) return Promise.resolve(false);
    return extensionChangesWorkspaceProvisioning(deps, installedSource);
  };

  const provisionWhenRequired = async (projectId: string, required: boolean) => {
    if (!required) return;
    await (deps.provisionProjectWorkspaces ?? provisionProjectWorkspaces)(deps, projectId);
  };

  const projectExtension = async (
    instance: NonNullable<Awaited<ReturnType<LifecycleDeps["extensionService"]["setProjectExtensionEnabled"]>>>,
    installedSource: NonNullable<Awaited<ReturnType<LifecycleDeps["extensionService"]["getInstalledSource"]>>>,
  ): Promise<ProjectExtensionInstance> =>
    toProjectExtensionInstance(instance, installedSource, installedSource.source_hash, {
      canUpgrade: await deps.extensionUpgradeService?.canUpgrade(installedSource),
    });

  const copiesOf = async (projectId: string, extensionId: string) =>
    (await deps.extensionService.listProjectExtensionInstances(projectId)).filter(
      ({ installedSource }) => installedSource.extension_id === extensionId,
    );

  const install = async (projectId: string, input: InstallExtensionRequest | UploadExtensionRequest) => {
    if (!deps.extensionUpgradeService)
      throw new ExtensionUpgradeUnavailableError("Extension installation is unavailable.");
    const source = await deps.extensionUpgradeService.installSource(projectId, input);
    const result = await deps.extensionService.enableInstalledSourceForProject({
      projectId,
      installName: source.installName,
      ...toExtensionEnableInput(source),
    });
    await provisionWhenRequired(projectId, await changesWorkspaceProvisioning(result.installedSource));
    return { source, extension: await projectExtension(result.instance, result.installedSource) };
  };

  const setEnabled = async (projectId: string, instanceId: string, enabled: boolean) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    const requiresProvisioning = await changesWorkspaceProvisioning(existing.installedSource);

    const extensionId = existing.installedSource.extension_id;
    const updated = await deps.extensionService.setProjectExtensionEnabled(instanceId, enabled);
    if (!updated) return null;
    await refreshProviderWorkspaces(deps, projectId, extensionId);
    // Shared only after this device accepted the change, so other devices never get a state it refused.
    // A leftover copy that this device does not run leaves the shared choice alone.
    if (selectPublicationSource(await copiesOf(projectId, extensionId))?.instance.id === instanceId)
      await shareEnabledChoice(deps, projectId, extensionId, enabled);

    await provisionWhenRequired(projectId, requiresProvisioning);
    return projectExtension(updated, existing.installedSource);
  };

  const setAutomationEnabled = async (
    projectId: string,
    instanceId: string,
    automationId: string,
    enabled: boolean,
  ): Promise<WorkbenchExtensionAutomationRecord | null> => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;

    const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
    const schedule = snapshot.runtime.schedules.find(
      (candidate) =>
        candidate.id === canonicalRuntimeId(snapshot.runtime, automationId) &&
        candidate.extensionId === existing.installedSource.extension_id,
    );
    if (!schedule) return null;

    await setDeviceAutomationEnabled(deps, projectId, { scheduleId: schedule.id, instanceId, enabled });

    return {
      id: schedule.id,
      localId: schedule.localId,
      extensionId: schedule.extensionId,
      extensionInstanceId: instanceId,
      title: schedule.title,
      cron: schedule.cron,
      commandId: schedule.commandId,
      enabled,
    };
  };

  const uninstall = async (input: { projectId: string; instanceId: string; deleteUserData: boolean }) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(input.projectId, input.instanceId);
    if (!existing) return null;
    const requiresProvisioning = await changesWorkspaceProvisioning(existing.installedSource);
    const providerWorkspaces = await extensionProviderWorkspaces(
      deps,
      input.projectId,
      existing.installedSource.extension_id,
    );
    if (providerWorkspaces.length > 0) {
      throw new ExtensionProviderInUseError(
        `Extension still owns ${providerWorkspaces.length} provider-backed workspace(s). Delete them before uninstalling.`,
      );
    }
    const extensionId = existing.installedSource.extension_id;
    // Removing a leftover copy that this device does not run keeps the extension on every device.
    const runsSelectedCopy =
      selectPublicationSource(await copiesOf(input.projectId, extensionId))?.instance.id === input.instanceId;
    // The shared removal comes first, so a sync cannot reinstall the extension in between.
    const restoreSharedSelection = runsSelectedCopy
      ? await removeSharedSelection(await openPublishedCatalog(deps, input.projectId), extensionId)
      : undefined;
    let result: Awaited<ReturnType<LifecycleDeps["extensionService"]["uninstallProjectExtension"]>>;
    try {
      result = await deps.extensionService.uninstallProjectExtension(input);
    } catch (error) {
      // This device still runs the extension, so other devices keep it too.
      // The caller needs the uninstall's own error, even when restoring the shared selection fails.
      await restoreSharedSelection?.().catch((restore) =>
        apiLogger.error(
          { event: "extension.publication.restore_failed", projectId: input.projectId, extensionId, err: restore },
          "The shared extension selection could not be restored after a failed uninstall",
        ),
      );
      throw error;
    }
    if (!result) return null;
    if (input.deleteUserData) {
      try {
        await deps.extensionConnectionService.removeExtension(input.projectId, extensionId);
      } catch (error) {
        apiLogger.error(
          { err: error, event: "extension.connection_cleanup.deferred", projectId: input.projectId },
          "Extension connection cleanup will retry at startup",
        );
      }
    }

    await provisionWhenRequired(input.projectId, requiresProvisioning);
    return result.retainedData ? ("retained-disabled" as const) : ("removed" as const);
  };

  return {
    install,
    setAutomationEnabled,
    setEnabled: (projectId: string, instanceId: string, enabled: boolean) =>
      withProjectExtensionChoices(deps.extensionService, projectId, () => setEnabled(projectId, instanceId, enabled)),
    uninstall: (input: Parameters<typeof uninstall>[0]) =>
      withProjectExtensionChoices(deps.extensionService, input.projectId, () => uninstall(input)),
  };
};
