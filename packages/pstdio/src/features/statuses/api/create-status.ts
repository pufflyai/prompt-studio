import { apiClient } from "@/features/api-client";

export const createStatus = async (
  projectId: string,
  input: {
    name: string;
    color: string;
    is_default?: boolean;
  },
) => apiClient().statuses.create(projectId, input);
