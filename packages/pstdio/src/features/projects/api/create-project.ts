import { apiClient } from "@/features/api-client";

export const createProject = (path: string, name?: string, teamAccountId?: string) =>
  apiClient().projects.create({
    name,
    ...(teamAccountId && { teamAccountId }),
    initial_workspace: { provider_id: "pstdio.root", params: { path } },
  });
