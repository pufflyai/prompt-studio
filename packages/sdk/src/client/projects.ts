import type {
  CreateProjectInput,
  ListActivityResponse,
  ListProjectActivityInput,
  UpdateProjectInput,
} from "pstdio-api-contracts";
import type { Project, Workspace } from "../resources";
import type { RequestFn } from "./request";

export type ProjectClient = {
  list(): Promise<Project[]>;
  get(projectId: string): Promise<Project>;
  create(input: CreateProjectInput): Promise<Project>;
  attachInitialWorkspace(projectId: string, input: CreateProjectInput["initial_workspace"]): Promise<Workspace>;
  retrySetup(projectId: string): Promise<Workspace>;
  update(projectId: string, input: UpdateProjectInput): Promise<Project>;
  delete(projectId: string): Promise<void>;
  listActivity(projectId: string, input?: ListProjectActivityInput): Promise<ListActivityResponse>;
};

export const createProjectClient = (request: RequestFn): ProjectClient => ({
  list: () => request("/v1/projects"),
  get: (projectId) => request(`/v1/projects/${projectId}`),
  create: (input) => request("/v1/projects", { method: "POST", body: input }),
  attachInitialWorkspace: (projectId, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/initial-workspace`, { method: "POST", body: input }),
  retrySetup: (projectId) => request(`/v1/projects/${projectId}/retry-setup`, { method: "POST" }),
  update: (projectId, input) => request(`/v1/projects/${projectId}`, { method: "PATCH", body: input }),
  delete: (projectId) => request(`/v1/projects/${projectId}`, { method: "DELETE" }),
  listActivity: (projectId, input = {}) => {
    const params = new URLSearchParams();
    if (input.resource_type) params.append("resource_type", input.resource_type);
    if (input.event_type) params.append("event_type", input.event_type);
    if (input.from) params.append("from", input.from);
    if (input.to) params.append("to", input.to);
    if (input.cursor) params.append("cursor", input.cursor);
    if (input.limit !== undefined) params.append("limit", String(input.limit));
    const query = params.toString();
    return request(`/v1/projects/${projectId}/activity${query ? `?${query}` : ""}`);
  },
});
