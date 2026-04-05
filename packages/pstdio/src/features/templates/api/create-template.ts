import { apiClient } from "@/features/api-client";

export const createTemplate = async (
  projectId: string,
  input: {
    name: string;
    template_type: string;
    content: string;
    is_default?: boolean;
  },
) =>
  apiClient().templates.create(projectId, {
    ...input,
    template_type: input.template_type as "prompt" | "ticket" | "document",
  });
