import { apiClient } from "@/features/api-client";

export const createProject = (path: string, name?: string) =>
  apiClient().projects.create({
    name,
    initial_workspace: { provider_id: "pstdio.root", params: { path } },
  });
