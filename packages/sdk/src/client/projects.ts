import type { CreateProjectInput, RegisterRepoInput, Repo } from "pstdio-api-contracts";
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
  listRepos(projectId: string): Promise<Repo[]>;
  registerRepo(projectId: string, input: RegisterRepoInput): Promise<Repo>;
  removeRepo(projectId: string, repoId: string): Promise<void>;
};

export const createProjectClient = (request: RequestFn): ProjectClient => ({
  list: () => request("/v1/projects"),
  get: (projectId) => request(`/v1/projects/${projectId}`),
  create: (input) => request("/v1/projects", { method: "POST", body: input }),
  delete: (projectId) => request(`/v1/projects/${projectId}`, { method: "DELETE" }),
  listPlugins: (projectId) => request(`/v1/projects/${projectId}/plugins`),
  registerPlugins: (projectId) => request(`/v1/projects/${projectId}/plugins/register`, { method: "POST" }),
  listRepos: (projectId) => request(`/v1/projects/${projectId}/repos`),
  registerRepo: (projectId, input) => request(`/v1/projects/${projectId}/repos`, { method: "POST", body: input }),
  removeRepo: (projectId, repoId) => request(`/v1/projects/${projectId}/repos/${repoId}`, { method: "DELETE" }),
});
