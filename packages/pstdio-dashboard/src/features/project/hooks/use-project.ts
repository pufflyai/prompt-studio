import { useQuery } from "@tanstack/react-query";
import type { StatusResponse, TagResponse } from "pstdio-api/dto";
import { DEFAULT_OWNER, DEFAULT_PROJECT_STATUS, getSystemInfo, toProjectRepository } from "@/features/project/data/api";
import type { Project, ProjectTemplateAsset } from "@/features/project/types";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import { toTicketStatusOption, toTicketTag } from "@/features/ticket-list/data/api";
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

  const { data: rawStatuses } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ s: getCollection("ticket_statuses") })
            .where(({ s }) => eq(s.project_id, projectId))
            .select(({ s }) => ({ ...s }))
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

  const { data: rawTags } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ t: getCollection("ticket_tags") })
            .where(({ t }) => eq(t.project_id, projectId))
            .select(({ t }) => ({ ...t }))
        : undefined,
    [projectId],
  );

  const { data: rawTagOptions } = useLiveQuery((q) =>
    q.from({ o: getCollection("ticket_tag_options") }).select(({ o }) => ({ ...o })),
  );

  if (!projectId) {
    return { data: undefined, isLoading };
  }

  if (!project) {
    return { data: undefined, isLoading };
  }

  const statusRows = asSyncedRows(rawStatuses);
  const projectRepoRows = asSyncedRows(rawProjectRepos);
  const repoRows = asSyncedRows(rawRepos);
  const tagRows = asSyncedRows(rawTags);

  const repoIds = new Set((projectRepoRows ?? []).map((pr) => pr.repo_id as string));
  const repos = (repoRows ?? []).filter((r) => repoIds.has(r.id));

  const statuses = [...(statusRows ?? [])].sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
  const statusOptions = statuses.map((s) => toTicketStatusOption(s as unknown as StatusResponse));
  const tagOptionRows = asSyncedRows(rawTagOptions);
  const tags = (tagRows ?? []).map((t) => {
    const options = (tagOptionRows ?? [])
      .filter((o) => o.tag_id === t.id && !o.deleted_at)
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
    return toTicketTag({
      ...t,
      options: options.map((o) => ({
        id: o.id as string,
        name: o.name as string,
        color: o.color as string,
        sort_order: o.sort_order as number,
        icon: (o.icon as string | null) ?? null,
        description: (o.description as string | null) ?? null,
      })),
    } as unknown as TagResponse);
  });

  const data: Project = {
    id: project.id,
    name: project.name as string,
    status: DEFAULT_PROJECT_STATUS,
    owner: DEFAULT_OWNER,
    updatedAt: project.updated_at as string,
    ticketStatuses: statusOptions.length ? statusOptions.map((s) => s.name) : ["Unassigned"],
    ticketStatusOptions: statusOptions,
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
  const { data: rawTemplates, isLoading } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ t: getCollection("templates") })
            .where(({ t }) => eq(t.project_id, projectId))
            .select(({ t }) => ({ ...t }))
        : undefined,
    [projectId],
  );
  const templateRows = asSyncedRows(rawTemplates)?.filter((t) => !t.deleted_at);

  const data: ProjectTemplateAsset[] | undefined = templateRows?.map((t) => ({
    id: t.id,
    projectId: (t.project_id as string) ?? projectId ?? "",
    name: t.name as string,
    templateType: t.template_type as ProjectTemplateAsset["templateType"],
    fileId: t.file_id as string,
    content: "",
    isDefault: t.is_default as boolean,
    createdAt: t.created_at as string,
    updatedAt: t.updated_at as string,
  }));

  return { data, isLoading };
};

export const useSystemInfo = () =>
  useQuery({
    queryKey: ["system-info"],
    queryFn: () => getSystemInfo(),
  });
