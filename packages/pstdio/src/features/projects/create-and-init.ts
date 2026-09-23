import { apiClient } from "@/features/api-client";
import { createProject } from "./api/create-project";

export const createAndInitProject = async (path: string, name?: string) => {
  const project = await createProject(path, name);
  const workspaces = await apiClient().workspaces.list(project.id);
  const home = workspaces.find((workspace) => workspace.is_default);
  if (home?.setup_error) throw new Error(home.setup_error);
  if (!home?.root_path || home.initializing || home.provider_state !== "ready")
    throw new Error("The project folder is not ready. Open it again to retry setup.");
  return project;
};
