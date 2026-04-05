import { apiClient } from "@/features/api-client";

export const updateAgent = async (
  agentId: string,
  fields: {
    is_default?: boolean;
    binary?: string;
    skills_dir?: string;
  },
) => apiClient().agents.update(agentId, fields);
