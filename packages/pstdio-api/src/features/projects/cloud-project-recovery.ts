import { readCloudProjectInfo } from "../../services/relay/cloud-project-info";
import type { RelayWorkbench } from "../../services/relay/runtime";
import type { ProjectsRouteDeps } from "./deps";
import { setupProjectExtensions } from "./project-extension-setup";

const RECOVERY_TIMEOUT_MS = 30_000;

/**
 * Creates a cloud project of the account on a device that does not have it yet. Its data needs no
 * folder, so the project starts without one. The first view that needs files asks for a folder.
 */
export const recoverCloudProject = async (deps: ProjectsRouteDeps, connection: RelayWorkbench) => {
  const { name } = await readCloudProjectInfo(connection, AbortSignal.timeout(RECOVERY_TIMEOUT_MS));
  // No device has published the project info yet. The account's next refresh tries again.
  if (!name) return;
  const installDefaults = (await deps.projectService.list()).length === 0;
  await deps.projectService.create({ id: connection.workbenchId, name }, async (project) => {
    await deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });
    await setupProjectExtensions(deps, project.id, installDefaults);
  });
  await deps.extensionRuntimeCatalog.activate(connection.workbenchId);
};
