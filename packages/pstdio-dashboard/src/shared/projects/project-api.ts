import type { Project as ProjectResponse, Template as TemplateResponse } from "@pstdio/sdk/resources";
import { apiRequest, readRuntimeConfig } from "@/lib/api";
import type {
  Project,
  ProjectRepository,
  ProjectTemplateAsset,
  ProjectTemplateAssetType,
  RepoBranch,
} from "./project-types";

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

export const toProjectRepository = (repo: ApiRepo): ProjectRepository => ({
  id: repo.id,
  name: repo.name,
  displayName: repo.display_name,
  path: repo.path,
  createdAt: repo.created_at,
  updatedAt: repo.updated_at,
});

export const getProject = async (projectId: string) => {
  const project = await apiRequest<ProjectResponse | null>(`/v1/projects/${projectId}`, {
    allowNotFound: true,
  });

  if (!project) {
    return null;
  }

  const [repositories] = await Promise.all([apiRequest<ApiRepo[]>(`/v1/projects/${projectId}/repos`)]);

  return {
    id: project.id,
    name: project.name,
    shorthand: project.shorthand,
    default_agent_id: project.default_agent_id,
    default_agent_model: project.default_agent_model,
    startup_script: project.startup_script,
    created_at: project.created_at,
    updated_at: project.updated_at,
    deleted_at: project.deleted_at,
    repositories: repositories.map(toProjectRepository),
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

export const removeProjectRepository = async (projectId: string, repoId: string) => {
  await apiRequest(`/v1/projects/${projectId}/repos/${repoId}`, { method: "DELETE" });
};

export type UpdateProjectDefaultsInput = {
  default_agent_id?: string | null;
  default_agent_model?: string | null;
};

export const getProjectDefaults = (projectId: string) => apiRequest<ProjectResponse>(`/v1/projects/${projectId}`);

export const updateProjectDefaults = (projectId: string, input: UpdateProjectDefaultsInput) =>
  apiRequest<ProjectResponse>(`/v1/projects/${projectId}`, { method: "PATCH", body: input });

type ApiBranch = {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  last_commit_date: string;
};

export const getRepoBranches = async (repoId: string): Promise<RepoBranch[]> => {
  const branches = await apiRequest<ApiBranch[]>(`/v1/repos/${repoId}/branches`);
  return branches.map((branch) => ({
    name: branch.name,
    isCurrent: branch.is_current,
    isRemote: branch.is_remote,
    lastCommitDate: branch.last_commit_date,
  }));
};

export const getProjectTemplateAssets = async (projectId: string) => {
  const templates = await apiRequest<TemplateResponse[]>(`/v1/projects/${projectId}/templates`);
  return templates.map((t) => ({
    id: t.id,
    projectId: t.project_id ?? projectId,
    name: t.name,
    title: t.title,
    templateType: t.template_type as ProjectTemplateAsset["templateType"],
    sourceKind: t.source_kind,
    installName: t.install_name,
    key: t.key,
    fileId: t.file_id,
    content: "",
    isDefault: t.is_default,
    enabled: t.enabled,
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
    title: t.title,
    templateType: t.template_type as ProjectTemplateAssetType,
    sourceKind: t.source_kind,
    installName: t.install_name,
    key: t.key,
    fileId: t.file_id,
    content: t.content,
    isDefault: t.is_default,
    enabled: t.enabled,
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
    title: created.title,
    templateType: created.template_type as ProjectTemplateAssetType,
    sourceKind: created.source_kind,
    fileId: created.file_id,
    content: input.content ?? "",
    isDefault: created.is_default,
    enabled: created.enabled,
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

export const updateInstalledExtensionTemplate = async (
  installName: string,
  key: string,
  input: { content: string },
) => {
  await apiRequest(`/v1/extensions/installed/${encodeURIComponent(installName)}/templates/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: input,
  });
};

export const deleteProjectTemplate = async (projectId: string, name: string) => {
  await apiRequest(`/v1/projects/${projectId}/templates/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
};
