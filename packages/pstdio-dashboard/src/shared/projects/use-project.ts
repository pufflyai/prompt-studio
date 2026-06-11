import { useQuery } from "@tanstack/react-query";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/lib/sync/collections";
import { getProjectTemplateAssets, getSystemInfo, toProjectRepository } from "./project-api";
import { isProjectQueryLoading } from "./project-query-loading-state";
import type { Project, ProjectTemplateAsset } from "./project-types";

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

  const { data: rawProjectRepos } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ pr: getCollection("project_repos") })
            .where(({ pr }) => eq(pr.project_id, projectId))
            .select(({ pr }) => ({ ...pr }))
        : undefined,
    [projectId],
  );

  const { data: rawRepos } = useLiveQuery((q) => q.from({ r: getCollection("repos") }).select(({ r }) => ({ ...r })));

  if (!projectId) {
    return { data: undefined, isLoading };
  }

  if (!project) {
    return { data: undefined, isLoading };
  }

  const projectRepoRows = asSyncedRows(rawProjectRepos);
  const repoRows = asSyncedRows(rawRepos);

  const repoIds = new Set((projectRepoRows ?? []).map((pr) => pr.repo_id as string));
  const repos = (repoRows ?? []).filter((r) => repoIds.has(r.id));

  const data: Project = {
    id: project.id,
    name: project.name as string,
    shorthand: project.shorthand as string,
    default_agent_id: (project.default_agent_id as string | null) ?? null,
    default_agent_model: (project.default_agent_model as string | null) ?? null,
    startup_script: (project.startup_script as string | null) ?? null,
    created_at: project.created_at as string,
    updated_at: project.updated_at as string,
    deleted_at: (project.deleted_at as string | null) ?? null,
    repositories: repos.map((r) => toProjectRepository(r as Parameters<typeof toProjectRepository>[0])),
  };

  return { data, isLoading };
};

export const useProjectRepositories = (projectId: string | undefined) => {
  const { data: rawProjectRepos } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ pr: getCollection("project_repos") })
            .where(({ pr }) => eq(pr.project_id, projectId))
            .select(({ pr }) => ({ ...pr }))
        : undefined,
    [projectId],
  );

  const { data: rawRepos } = useLiveQuery((q) => q.from({ r: getCollection("repos") }).select(({ r }) => ({ ...r })));

  const projectRepoRows = asSyncedRows(rawProjectRepos);
  const repoRows = asSyncedRows(rawRepos);

  const repoIds = new Set((projectRepoRows ?? []).map((pr) => pr.repo_id as string));
  const repos = (repoRows ?? []).filter((r) => repoIds.has(r.id));

  const data = repos.map((r) => toProjectRepository(r as Parameters<typeof toProjectRepository>[0]));

  return { data, isLoading: false };
};

export const useProjectTemplateAssets = (projectId: string | undefined) => {
  return useQuery<ProjectTemplateAsset[]>({
    queryKey: ["project-template-assets", projectId],
    queryFn: () => getProjectTemplateAssets(projectId!),
    enabled: Boolean(projectId),
  });
};

export const useSystemInfo = () =>
  useQuery({
    queryKey: ["system-info"],
    queryFn: () => getSystemInfo(),
  });
