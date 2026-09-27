import { apiClient } from "@/features/api-client";

export const getProjectFolder = async (projectId: string) => {
  const workspaces = await apiClient().workspaces.list(projectId);
  const home = workspaces.find((workspace) => workspace.is_default);
  if (home?.execution_kind !== "local" || !home.root_path) {
    throw new Error("The project does not have a local default workspace.");
  }
  return home.root_path;
};
