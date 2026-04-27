import { apiClient } from "@/features/api-client";

export const stopHarnessSession = async (sessionId: string) => apiClient().harnesses.stop(sessionId);
