import { apiClient } from "@/features/api-client";

export const createTag = async (
  projectId: string,
  input: {
    name: string;
    type: "single_select" | "multi_select";
    options?: { name: string; color: string }[];
  },
) => apiClient().tags.create(projectId, input);
