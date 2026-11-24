import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/lib/sync/collections";
import { isProjectQueryLoading } from "./project-query-loading-state";
import type { Project } from "./project-types";
import { useProjectedProjectDefaults } from "./synced-project-defaults";

export const useProject = (projectId: string | undefined) => {
  const { data: rawProject, isLoading: projectLoading } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ p: getCollection("projects") })
            .where(({ p }) => eq(p.id, projectId))
            .select(({ p }) => ({ ...p }))
        : undefined,
    [projectId],
  );
  const projectRows = asSyncedRows(rawProject);
  const isLoading = isProjectQueryLoading({
    projectId,
    rawProject,
    isProjectLoading: projectLoading,
  });
  const project = projectRows?.[0];

  const confirmed: Project | undefined =
    !projectId || !project
      ? undefined
      : {
          id: project.id,
          name: project.name as string,
          shorthand: project.shorthand as string,
          default_agent_id: (project.default_agent_id as string | null) ?? null,
          default_agent_model: (project.default_agent_model as string | null) ?? null,
          startup_script: (project.startup_script as string | null) ?? null,
          created_at: project.created_at as string,
          updated_at: project.updated_at as string,
          deleted_at: (project.deleted_at as string | null) ?? null,
        };

  const data = useProjectedProjectDefaults(projectId, confirmed);
  return { data, isLoading };
};
