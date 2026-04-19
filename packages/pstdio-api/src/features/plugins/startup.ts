import { apiLogger } from "../../lib/logger";
import type { RouteDeps } from "../deps";

type Deps = Pick<RouteDeps, "projectService" | "pluginService">;

export const startProjectSchedulers = async (deps: Deps) => {
  const projects = await deps.projectService.list();

  for (const project of projects) {
    try {
      await deps.pluginService.getForProject(project.id);
    } catch (err) {
      apiLogger.warn(
        { err, event: "plugin.scheduler.startup.failed", project_id: project.id },
        `Failed to start scheduler for project ${project.id}`,
      );
    }
  }
};
