import { getApiClient } from "@/lib/api";

export const createProject = async (input: { path: string }) => {
  const project = await getApiClient().projects.create({
    initial_workspace: { provider_id: "pstdio.root", params: { path: input.path } },
  });
  const workspaces = await getApiClient().workspaces.list(project.id);
  const home = workspaces.find((workspace) => workspace.is_default);
  if (home?.setup_error) throw new Error(home.setup_error);
  if (!home?.root_path || home.initializing || home.provider_state !== "ready")
    throw new Error("The project folder is not ready. Open it again to retry setup.");
  return project;
};
