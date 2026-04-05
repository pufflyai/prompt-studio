import { apiClient } from "@/features/api-client";

export const updateAttemptStatus = async (workspaceId: string, status: string, sessionId?: string) =>
  apiClient().workspaces.updateAttemptStatus(workspaceId, {
    status,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
