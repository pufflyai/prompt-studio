import { apiClient } from "@/features/api-client";

export const updateTemplate = async (
  projectId: string,
  name: string,
  input: {
    content?: string;
    is_default?: boolean;
  },
) => apiClient().templates.update(projectId, name, input);
