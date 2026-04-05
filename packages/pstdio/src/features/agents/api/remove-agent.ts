import { apiClient } from "@/features/api-client";

export const removeAgent = async (agentId: string) => {
  await apiClient().agents.delete(agentId);
};
