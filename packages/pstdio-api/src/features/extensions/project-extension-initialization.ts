import { projectEvents } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import type { ExtensionsRouteDeps } from "./deps";
import { fireExtensionEvent } from "./extension-event-runtime";
import { canonicalSourcePath } from "./project-extension-runtime-sources";

export const openProjectExtensions = async (
  deps: ExtensionsRouteDeps,
  input: { sourcePath?: string; signal?: AbortSignal } = {},
) => {
  const sourcePath = input.sourcePath ? canonicalSourcePath(input.sourcePath) : undefined;
  for (const project of await deps.projectService.list()) {
    if (input.signal?.aborted) return;
    try {
      if (sourcePath) {
        const sources = await deps.extensionService.listEnabledSourcesForProject(project.id);
        if (!sources.some(({ installedSource }) => canonicalSourcePath(installedSource.source_path) === sourcePath))
          continue;
      }
      await fireExtensionEvent(deps, project.id, projectEvents.opened, { projectId: project.id });
    } catch (err) {
      apiLogger.warn(
        { err, event: "extensions.project_open.failed", project_id: project.id },
        "Project extension initialization failed; other projects will continue",
      );
    }
  }
};
