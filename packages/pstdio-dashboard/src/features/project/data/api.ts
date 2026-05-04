import type { ProjectResponse, StatusResponse, TagResponse, TemplateResponse } from "pstdio-api/dto";
import type {
  Project,
  ProjectRepository,
  ProjectTemplateAsset,
  ProjectTemplateAssetType,
  RepoBranch,
} from "@/features/project/types";
import { buildTicketStatusCatalog, toTicketTag } from "@/features/ticket-list/data/api";
import { apiRequest, readRuntimeConfig } from "@/lib/api";

export type ApiSystemInfo = {
  version: string;
};

export type ApiRepo = {
  id: string;
  name: string;
  display_name: string | null;
  path: string;
  created_at: string;
  updated_at: string;
};

export type CreateProjectRepositoryInput = {
  path: string;
  displayName: string | null;
};

// --- Mappers ---

export const toProjectRepository = (repo: ApiRepo): ProjectRepository => ({
  id: repo.id,
  name: repo.name,
  displayName: repo.display_name,
  path: repo.path,
  createdAt: repo.created_at,
  updatedAt: repo.updated_at,
});

// --- API functions ---

export const getProject = async (projectId: string) => {
  const project = await apiRequest<ProjectResponse | null>(`/v1/projects/${projectId}`, {
    allowNotFound: true,
  });

  if (!project) {
    return null;
  }

  const fetchTicketStatuses = async (projectId: string) => {
    const statuses = await apiRequest<StatusResponse[]>(`/v1/projects/${projectId}/ticket-statuses`);
    return buildTicketStatusCatalog(statuses);
  };

  const [statusCatalog, repositories, ticketTags] = await Promise.all([
    fetchTicketStatuses(projectId),
    apiRequest<ApiRepo[]>(`/v1/projects/${projectId}/repos`),
    apiRequest<TagResponse[]>(`/v1/projects/${projectId}/ticket-tags`),
  ]);

  return {
    id: project.id,
    name: project.name,
    shorthand: project.shorthand,
    selected_agents: project.selected_agents,
    default_agent_id: project.default_agent_id,
    default_agent_model: project.default_agent_model,
    startup_script: project.startup_script,
    created_at: project.created_at,
    updated_at: project.updated_at,
    deleted_at: project.deleted_at,
    ticketStatuses: statusCatalog.names,
    ticketStatusOptions: statusCatalog.options,
    repositories: repositories.map(toProjectRepository),
    ticketTags: ticketTags.map(toTicketTag),
  } satisfies Project;
};

export const getSystemInfo = async () => {
  const runtimeVersion = readRuntimeConfig()?.version?.trim();
  if (runtimeVersion) {
    return {
      version: runtimeVersion,
    };
  }

  const buildVersion = import.meta.env.VITE_APP_VERSION?.trim();
  return {
    version: buildVersion && buildVersion.length > 0 ? buildVersion : "dev",
  };
};

export const getProjectRepositories = async (projectId: string) => {
  const repositories = await apiRequest<ApiRepo[]>(`/v1/projects/${projectId}/repos`);
  return repositories.map(toProjectRepository);
};

const resolveRepoName = (path: string, displayName?: string | null) => {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/g, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  return segments.at(-1) ?? "repo";
};

export const addProjectRepository = async (projectId: string, input: { path: string; displayName?: string | null }) => {
  const repo = await apiRequest<ApiRepo>(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    body: {
      name: resolveRepoName(input.path, input.displayName),
      path: input.path,
    },
  });

  return toProjectRepository(repo);
};

export const removeProjectRepository = async (projectId: string, repoId: string) => {
  await apiRequest(`/v1/projects/${projectId}/repos/${repoId}`, { method: "DELETE" });
};

type ApiBranch = {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  last_commit_date: string;
};

export const getRepoBranches = async (repoId: string): Promise<RepoBranch[]> => {
  const branches = await apiRequest<ApiBranch[]>(`/v1/repos/${repoId}/branches`);
  return branches.map((b) => ({
    name: b.name,
    isCurrent: b.is_current,
    isRemote: b.is_remote,
    lastCommitDate: b.last_commit_date,
  }));
};

export const getProjectTemplateAssets = async (projectId: string): Promise<ProjectTemplateAsset[]> => {
  const templates = await apiRequest<TemplateResponse[]>(`/v1/projects/${projectId}/templates`);
  return templates.map((t) => ({
    id: t.id,
    projectId: t.project_id ?? projectId,
    name: t.name,
    templateType: t.template_type as ProjectTemplateAsset["templateType"],
    fileId: t.file_id,
    content: "",
    isDefault: t.is_default,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
};

export const getProjectTemplate = async (projectId: string, name: string) => {
  const t = await apiRequest<TemplateResponse & { content: string }>(
    `/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`,
  );

  return {
    id: t.id,
    projectId: t.project_id ?? projectId,
    name: t.name,
    templateType: t.template_type as ProjectTemplateAssetType,
    fileId: t.file_id,
    content: t.content,
    isDefault: t.is_default,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  } satisfies ProjectTemplateAsset;
};

export const createProjectTemplate = async (
  projectId: string,
  input: { name: string; templateType: ProjectTemplateAssetType; content?: string; isDefault?: boolean },
) => {
  const created = await apiRequest<TemplateResponse>(`/v1/projects/${projectId}/templates`, {
    method: "POST",
    body: {
      name: input.name,
      template_type: input.templateType,
      ...(input.content != null && { content: input.content }),
      is_default: input.isDefault,
    },
  });

  return {
    id: created.id,
    projectId: created.project_id ?? projectId,
    name: created.name,
    templateType: created.template_type as ProjectTemplateAssetType,
    fileId: created.file_id,
    content: input.content ?? "",
    isDefault: created.is_default,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  } satisfies ProjectTemplateAsset;
};

export const updateProjectTemplate = async (
  projectId: string,
  name: string,
  input: { content?: string; isDefault?: boolean; templateType?: ProjectTemplateAssetType },
) => {
  await apiRequest(`/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
      ...(input.templateType !== undefined ? { template_type: input.templateType } : {}),
    },
  });
};

export const deleteProjectTemplate = async (projectId: string, name: string) => {
  await apiRequest(`/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
};
