import { createClient } from "@pstdio/sdk/client";

type ListOptions = {
  status?: string;
  agent?: string;
  workspaceId?: string;
  archived?: boolean;
};

export const listSessions = async (baseUrl: string, projectId: string, options?: ListOptions) => {
  return createClient({ baseUrl }).sessions.list(projectId, options);
};
