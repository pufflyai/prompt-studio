import { apiClient } from "@/features/api-client";

export const updateHarness = async (
  harnessId: string,
  fields: { is_default?: boolean; binary?: string; skills_dir?: string },
) => apiClient().harnesses.update(harnessId, fields);
