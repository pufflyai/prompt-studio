import type {
  BindEnvironmentInput,
  CreateProjectInput,
  EnvironmentBinding,
  UpdateProjectInput,
} from "pstdio-api-contracts";
import type { Project, Workspace } from "../resources";
import type { RequestFn } from "./request";

export type ProjectClient = {
  list(): Promise<Project[]>;
  get(projectId: string): Promise<Project>;
  create(input: CreateProjectInput): Promise<Project>;
  bindEnvironment(workbenchId: string, input: BindEnvironmentInput): Promise<EnvironmentBinding>;
  attachInitialWorkspace(projectId: string, input: CreateProjectInput["initial_workspace"]): Promise<Workspace>;
  retrySetup(projectId: string): Promise<Workspace>;
  update(projectId: string, input: UpdateProjectInput): Promise<Project>;
  delete(projectId: string): Promise<void>;
};

export const createProjectClient = (request: RequestFn): ProjectClient => ({
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
