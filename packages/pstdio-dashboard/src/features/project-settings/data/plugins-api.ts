import { apiRequest } from "@/lib/api";

export type PluginInfo = {
  identity: string;
  filePath: string;
};

export type ProjectPluginsResponse = {
  plugins: PluginInfo[];
  pluginsDir: string | null;
};

export const getProjectPlugins = async (projectId: string) =>
  apiRequest<ProjectPluginsResponse>(`/v1/projects/${projectId}/plugins`);
