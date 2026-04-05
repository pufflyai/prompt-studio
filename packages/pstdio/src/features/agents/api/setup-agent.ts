import { apiClient } from "@/features/api-client";

export const setupAgent = async (agentId: string, binary?: string) =>
  apiClient().agents.setup(binary ? { agent_id: agentId, binary } : { agent_id: agentId });
