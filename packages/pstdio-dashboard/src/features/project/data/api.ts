import type { ProjectResponse, TemplateResponse } from "pstdio-api/dto";
import type {
  Project,
  ProjectRepository,
  ProjectTemplateAsset,
  ProjectTemplateAssetType,
  RepoBranch,
} from "@/features/project/types";
import { getProjectTicketStatuses, getProjectTicketTags } from "@/features/ticket-list/data/api";
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

export const DEFAULT_OWNER = "Unassigned";
export const DEFAULT_PROJECT_STATUS = "active";

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

  const [statusCatalog, repositories, ticketTags] = await Promise.all([
    getProjectTicketStatuses(projectId),
    apiRequest<ApiRepo[]>(`/v1/projects/${projectId}/repos`),
    getProjectTicketTags(projectId),
  ]);

  return {
    id: project.id,
    name: project.name,
    status: DEFAULT_PROJECT_STATUS,
    owner: DEFAULT_OWNER,
    updatedAt: project.updated_at,
    ticketStatuses: statusCatalog.map((status) => status.name),
    ticketStatusOptions: statusCatalog,
    repositories: repositories.map(toProjectRepository),
    ticketTags,
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
  return templates.map(toProjectTemplateAsset(projectId, ""));
};

const toProjectTemplateAsset =
  (projectId: string, content: string) =>
  (t: TemplateResponse): ProjectTemplateAsset => ({
    id: t.id,
    projectId: t.project_id ?? projectId,
    name: t.name,
    templateType: t.template_type as ProjectTemplateAsset["templateType"],
    fileId: t.file_id,
    content,
    isDefault: t.is_default,
    sourceKind: t.source_kind ?? undefined,
    readOnly: t.read_only ?? undefined,
    title: t.title ?? undefined,
    description: t.description ?? undefined,
    originExtensionId: t.origin_extension_id ?? undefined,
    originTemplateKey: t.origin_template_key ?? undefined,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  });

export const getProjectTemplate = async (projectId: string, name: string) => {
  const t = await apiRequest<TemplateResponse & { content: string }>(
    `/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`,
  );

  return toProjectTemplateAsset(projectId, t.content)(t);
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

  return toProjectTemplateAsset(projectId, input.content ?? "")(created);
};

export const copyProjectTemplate = async (projectId: string, name: string) => {
  const copied = await apiRequest<TemplateResponse>(
    `/v1/projects/${projectId}/templates/${encodeURIComponent(name)}/copy`,
    {
      method: "POST",
      body: {},
    },
  );

  return toProjectTemplateAsset(projectId, "")(copied);
};

export const disableProjectTemplateDefault = async (projectId: string, name: string) => {
  const template = await apiRequest<TemplateResponse>(
    `/v1/projects/${projectId}/templates/${encodeURIComponent(name)}/disable`,
    {
      method: "POST",
    },
  );

  return toProjectTemplateAsset(projectId, "")(template);
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
