import { apiClient } from "@/features/api-client";

export const archiveSession = async (sessionId: string) => {
  await apiClient().sessions.archive(sessionId);
  return { id: sessionId };
};
