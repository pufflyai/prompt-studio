import type { ProjectExtensionInstance, WorkbenchExtensionAutomationRecord } from "pstdio-api-contracts";
import { apiLogger } from "../../lib/logger";
import { ExtensionUpgradeUnavailableError } from "../../services/extension-upgrade-service";
import { provisionProjectWorkspaces } from "../workspaces/provision-coordinator";
import type { ExtensionsRouteDeps } from "./deps";
import { extensionChangesWorkspaceProvisioning } from "./extension-skill-cleanup";
import { toProjectExtensionInstance } from "./project-extension-instance";

type LifecycleDeps = ExtensionsRouteDeps & {
  provisionProjectWorkspaces?: typeof provisionProjectWorkspaces;
};

export type ProjectExtensionLifecycle = ReturnType<typeof createProjectExtensionLifecycle>;

export type ProjectExtensionLifecycleRouteDeps = ExtensionsRouteDeps & {
  projectExtensionLifecycle: ProjectExtensionLifecycle;
};

export class ExtensionProviderInUseError extends Error {}

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

  const installMarketplace = async (projectId: string, installName: string) => {
    const marketplace = deps.extensionUpgradeService;
    if (!marketplace) {
      throw new ExtensionUpgradeUnavailableError("This Prompt Studio host does not support marketplace installs.");
    }

    const result = await marketplace.installMarketplaceExtension(projectId, installName);
    await provisionWhenRequired(projectId, await changesWorkspaceProvisioning(result.installedSource));
    return { extension: await projectExtension(result.instance, result.installedSource) };
  };

  const setEnabled = async (projectId: string, instanceId: string, enabled: boolean) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    const requiresProvisioning = await changesWorkspaceProvisioning(existing.installedSource);

    const updated = await deps.extensionService.setProjectExtensionEnabled(instanceId, enabled);
    if (!updated) return null;

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
      (candidate) => candidate.id === automationId && candidate.extensionId === existing.installedSource.extension_id,
    );
    if (!schedule) return null;

    const preference = await deps.extensionAutomationPreferencesService.set({
      project_id: projectId,
      extension_instance_id: instanceId,
      automation_id: automationId,
      enabled,
    });
    deps.eventBus.emit("extension_automation_preferences", "set", preference);

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
    const providerPrefix = `${existing.installedSource.extension_id}.workspace-type.`;
    const providerWorkspaces = (await deps.workspaceService.listForProviderReconciliation(input.projectId)).filter(
      (workspace) => workspace.provider_id.startsWith(providerPrefix),
    );
    if (providerWorkspaces.length > 0) {
      throw new ExtensionProviderInUseError(
        `Extension still owns ${providerWorkspaces.length} provider-backed workspace(s). Delete them before uninstalling.`,
      );
    }
    const result = await deps.extensionService.uninstallProjectExtension(input);
    if (!result) return null;
    if (input.deleteUserData) {
      try {
        await deps.extensionConnectionService.removeExtension(input.projectId, existing.installedSource.extension_id);
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

  return { installMarketplace, setAutomationEnabled, setEnabled, uninstall };
};
