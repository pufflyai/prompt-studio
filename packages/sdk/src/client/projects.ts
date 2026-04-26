import type {
  CreateProjectInput,
  ListProjectActivityForTicketsInput,
  ListTicketActivityResponse,
  RegisterRepoInput,
  Repo,
} from "pstdio-api-contracts";
import type { Project } from "../resources";
import type { RequestFn } from "./request";

type RegisteredPlugin = {
  identity: string;
  filePath: string;
};

type RegisteredPluginsResponse = {
  plugins: RegisteredPlugin[];
  pluginsDir: string | null;
};

export type ProjectClient = {
  list(): Promise<Project[]>;
  get(projectId: string): Promise<Project>;
  create(input: CreateProjectInput): Promise<Project>;
  delete(projectId: string): Promise<void>;
  listPlugins(projectId: string): Promise<RegisteredPluginsResponse>;
  registerPlugins(projectId: string): Promise<RegisteredPluginsResponse>;
  listActivity(projectId: string, input?: ListProjectActivityForTicketsInput): Promise<ListTicketActivityResponse>;
  listRepos(projectId: string): Promise<Repo[]>;
  registerRepo(projectId: string, input: RegisterRepoInput): Promise<Repo>;
  removeRepo(projectId: string, repoId: string): Promise<void>;
};

export const createProjectClient = (request: RequestFn): ProjectClient => ({
  list: () => request("/v1/projects"),
  get: (projectId) => request(`/v1/projects/${projectId}`),
  create: (input) => request("/v1/projects", { method: "POST", body: input }),
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
  listPlugins: (projectId) => request(`/v1/projects/${projectId}/plugins`),
  registerPlugins: (projectId) => request(`/v1/projects/${projectId}/plugins/register`, { method: "POST" }),
  listRepos: (projectId) => request(`/v1/projects/${projectId}/repos`),
  registerRepo: (projectId, input) => request(`/v1/projects/${projectId}/repos`, { method: "POST", body: input }),
  removeRepo: (projectId, repoId) => request(`/v1/projects/${projectId}/repos/${repoId}`, { method: "DELETE" }),
});
