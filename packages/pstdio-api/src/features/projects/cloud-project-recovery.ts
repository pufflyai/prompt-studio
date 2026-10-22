import { apiLogger } from "../../lib/logger";
import { readCloudProjectInfo } from "../../services/relay/cloud-project-info";
import type { RelayWorkbench } from "../../services/relay/runtime";
import type { ProjectsRouteDeps } from "./deps";
import { setupProjectExtensions } from "./project-extension-setup";

const RECOVERY_TIMEOUT_MS = 30_000;

/**
 * Creates a cloud project of the account on a device that does not have it yet. Its data needs no
 * folder, so the project starts without one. The first view that needs files asks for a folder.
 */
export const recoverCloudProject = async (deps: ProjectsRouteDeps, connection: RelayWorkbench, signal: AbortSignal) => {
  const { info, state } = await readCloudProjectInfo(
    connection,
    AbortSignal.any([signal, AbortSignal.timeout(RECOVERY_TIMEOUT_MS)]),
  );
  if (!info.name) {
    // A device that has the project publishes its info after its next full sync.
    apiLogger.info(
      { event: "account.cloud_project.info_pending", projectId: connection.workbenchId },
      "Cloud project waits for its info",
    );
    return;
  }
  signal.throwIfAborted();
  const installDefaults = (await deps.projectService.list()).length === 0;
  await deps.projectService.create({ id: connection.workbenchId, name: info.name }, async (project) => {
    // Keep the downloaded history, so a rename here before the first full sync builds on it.
    await deps.projectInfoService.merge(project.id, state);
    await deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });
    await setupProjectExtensions(deps, project.id, installDefaults);
  });
  await deps.extensionRuntimeCatalog.activate(connection.workbenchId);
};
