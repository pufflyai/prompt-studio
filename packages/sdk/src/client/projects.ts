import type {
  BindEnvironmentInput,
  CreateProjectInput,
  EnvironmentBinding,
  InitialWorkspaceRequest,
  Page,
  PageQuery,
  ProjectCreateRequest,
  ProjectDetails,
  ProjectSnapshot,
  ProjectUpdateRequest,
  RestoreProjectInput,
  UpdateProjectInput,
} from "pstdio-api-contracts";
import type { ExtensionWorkspace } from "pstdio-api-contracts/extension-kernel";
import type { Project, Workspace } from "../resources";
import { pageQuery } from "./page-query";
import type { RequestFn } from "./request";

export type ProjectClient = {
  snapshots(projectId: string): Promise<ProjectSnapshot[]>;
  restore(projectId: string, input: RestoreProjectInput): Promise<{ restored: number }>;
  query(input?: PageQuery): Promise<Page<Project & ProjectDetails>>;
  /** @deprecated Use query to read one bounded page. */
  list(): Promise<Project[]>;
  get(projectId: string): Promise<Project & ProjectDetails>;
  create(input: ProjectCreateRequest | CreateProjectInput): Promise<Project & ProjectDetails>;
  bindEnvironment(
    workbenchId: string,
    input: BindEnvironmentInput,
  ): Promise<EnvironmentBinding & { workspace: Workspace & ExtensionWorkspace }>;
  attachInitialWorkspace(
    projectId: string,
    input: InitialWorkspaceRequest | CreateProjectInput["initial_workspace"],
  ): Promise<Workspace & ExtensionWorkspace>;
  retrySetup(projectId: string): Promise<Workspace & ExtensionWorkspace>;
  update(projectId: string, input: ProjectUpdateRequest | UpdateProjectInput): Promise<Project & ProjectDetails>;
  delete(projectId: string): Promise<void>;
};

export const createProjectClient = (request: RequestFn): ProjectClient => ({
  snapshots: (projectId) => request(`/v1/projects/${encodeURIComponent(projectId)}/snapshots`),
  restore: (projectId, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/restore`, { method: "POST", body: input }),
  query: (input) => request(`/v1/projects/query${pageQuery(input)}`),
  list: () => request("/v1/projects"),
  get: (projectId) => request(`/v1/projects/${projectId}`),
  create: (input) => request("/v1/projects", { method: "POST", body: input }),
  bindEnvironment: (workbenchId, input) =>
    request(`/v1/projects/${encodeURIComponent(workbenchId)}/environment-binding`, { method: "PUT", body: input }),
  attachInitialWorkspace: (projectId, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/initial-workspace`, { method: "POST", body: input }),
  retrySetup: (projectId) => request(`/v1/projects/${projectId}/retry-setup`, { method: "POST" }),
  update: (projectId, input) => request(`/v1/projects/${projectId}`, { method: "PATCH", body: input }),
  delete: (projectId) => request(`/v1/projects/${projectId}`, { method: "DELETE" }),
});
