import type { Session } from "@pstdio/sdk/resources";
import { apiClient } from "@/features/api-client";

type ListOptions = {
  status?: string;
  agent?: string;
  workspaceId?: string;
  archived?: boolean;
};

export const listSessions = async (baseUrl: string, projectId: string, options?: ListOptions) => {
  // SDK sessions.list only accepts projectId, but the raw API supports query filters.
  // Use raw fetch for filters, SDK for the simple case.
  if (options?.status || options?.agent || options?.archived) {
    const params = new URLSearchParams({ project_id: projectId });
    if (options.status) params.set("status", options.status);
    if (options.agent) params.set("agent", options.agent);
    if (options.archived) params.set("archived", "true");

    const res = await fetch(`${baseUrl}/v1/sessions?${params}`);
    if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
    return (await res.json()) as Session[];
  }

  return apiClient().sessions.list(projectId);
};
