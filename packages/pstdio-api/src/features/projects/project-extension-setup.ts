import type { ExtensionSetupWarning } from "pstdio-api-contracts";
import { apiLogger } from "../../lib/logger";
import { traceSetupPhase } from "../../lib/setup-phase";
import { AlwaysEnabledExtensionError } from "../extensions/always-on-extensions";
import {
  installMissingDefaultExtensions,
  registerInstalledExtensionSources,
  syncInstalledExtensionsForProject,
} from "../extensions/default-extensions";
import type { ProjectsRouteDeps } from "./deps";

const enableSyncedProjectExtensions = async (deps: ProjectsRouteDeps, projectId: string, existingIds: Set<string>) => {
  const extensions = await deps.extensionService.listProjectExtensionInstances(projectId);
  for (const { instance } of extensions) {
    if (instance.enabled || existingIds.has(instance.id)) continue;
    try {
      await deps.extensionService.setProjectExtensionEnabled(instance.id, true);
    } catch (error) {
      // Discovery has already enabled the required provider. Leave alternate copies off.
      if (!(error instanceof AlwaysEnabledExtensionError)) throw error;
    }
  }
};

const messageFromError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const createExtensionWarning = (extension: string, error: unknown): ExtensionSetupWarning => ({
  code: "extension_setup_failed",
  extension,
  message: messageFromError(error),
});

const logExtensionWarning = (warning: ExtensionSetupWarning) => {
  apiLogger.warn(
    {
      code: warning.code,
      event: "projects.extension_setup.warning",
      extension: warning.extension,
      message: warning.message,
    },
    "Project extension setup warning",
  );
};

export const prepareDefaultProjectExtensions = async (deps: ProjectsRouteDeps) => {
  const warnings: ExtensionSetupWarning[] = [];
  const addWarning = (warning: ExtensionSetupWarning) => {
    warnings.push(warning);
    logExtensionWarning(warning);
  };

  try {
    const installed = await installMissingDefaultExtensions({
      forceSourceDefaults: process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1",
      onInstallFailure: ({ error, installName }) => addWarning(createExtensionWarning(installName, error)),
      releaseRef: deps.extensionUpgradeService?.releaseRef,
    });
    await traceSetupPhase("project.extension_register", {}, () =>
      registerInstalledExtensionSources(deps.extensionService, installed),
    );
  } catch (error) {
    addWarning(createExtensionWarning("default extensions", error));
  }
  return warnings;
};

export const setupProjectExtensions = async (
  deps: ProjectsRouteDeps,
  projectId: string,
  installDefaults: boolean,
  preservedInstanceIds = new Set<string>(),
) => {
  const warnings = installDefaults ? await prepareDefaultProjectExtensions(deps) : [];
  const addWarning = (warning: ExtensionSetupWarning) => {
    warnings.push(warning);
    logExtensionWarning(warning);
  };

  await traceSetupPhase("project.extension_sync", { project_id: projectId }, () =>
    syncInstalledExtensionsForProject({
      extensionService: deps.extensionService,
      onLoadFailure: ({ error, installName }) => addWarning(createExtensionWarning(installName, error)),
      projectId,
    }),
  );
  await traceSetupPhase("project.extension_enable", { project_id: projectId }, () =>
    enableSyncedProjectExtensions(deps, projectId, preservedInstanceIds),
  );

  return warnings;
};

export const retryProjectExtensions = async (deps: ProjectsRouteDeps, projectId: string) => {
  // Discovery can register disabled instances before first setup; only retries have prior choices to preserve.
  const existingInstances = await deps.extensionService.listProjectExtensionInstances(projectId);
  return setupProjectExtensions(deps, projectId, true, new Set(existingInstances.map(({ instance }) => instance.id)));
};
