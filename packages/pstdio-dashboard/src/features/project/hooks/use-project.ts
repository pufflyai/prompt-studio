import { useQuery } from "@tanstack/react-query";
import type { StatusResponse, TagResponse } from "pstdio-api/dto";
import {
  DEFAULT_OWNER,
  DEFAULT_PROJECT_STATUS,
  getProjectTemplateAssets,
  getSystemInfo,
  toProjectRepository,
} from "@/features/project/data/api";
import type { Project } from "@/features/project/types";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import { toTicketStatusOption, toTicketTag } from "@/features/ticket-list/data/api";
import {
  plannerCollectionRows,
  toPlannerStatusRows,
  toPlannerTagRows,
} from "@/features/ticket-list/hooks/planner-extension-rows";
import { withPlannerFallbackStatus } from "./planner-status-fallback";
import { isProjectQueryLoading } from "./project-query-loading-state";

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

  const { data: rawPlannerItems } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ item: getCollection("extension_collection_items") })
            .where(({ item }) => eq(item.project_id, projectId))
            .select(({ item }) => ({ ...item }))
        : undefined,
    [projectId],
  );

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

  const plannerRows = asSyncedRows(rawPlannerItems);
  const projectRepoRows = asSyncedRows(rawProjectRepos);
  const repoRows = asSyncedRows(rawRepos);

  const repoIds = new Set((projectRepoRows ?? []).map((pr) => pr.repo_id as string));
  const repos = (repoRows ?? []).filter((r) => repoIds.has(r.id));

  const statusRows = toPlannerStatusRows(plannerCollectionRows(plannerRows, "statuses", projectId));
  const statuses = [...(statusRows ?? [])].sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
  const statusOptions = statuses.map((s) => toTicketStatusOption(s as unknown as StatusResponse));
  const resolvedStatusOptions = withPlannerFallbackStatus(statusOptions);
  const tagRows = toPlannerTagRows(
    plannerCollectionRows(plannerRows, "tags", projectId),
    plannerCollectionRows(plannerRows, "tag_options", projectId),
  );
  const tags = tagRows.map((t) => {
    return toTicketTag({
      ...t,
    } as unknown as TagResponse);
  });

  const data: Project = {
    id: project.id,
    name: project.name as string,
    status: DEFAULT_PROJECT_STATUS,
    owner: DEFAULT_OWNER,
    updatedAt: project.updated_at as string,
    ticketStatuses: resolvedStatusOptions.map((s) => s.name),
    ticketStatusOptions: resolvedStatusOptions,
    repositories: repos.map((r) => toProjectRepository(r as Parameters<typeof toProjectRepository>[0])),
    ticketTags: tags,
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
  return useQuery({
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
