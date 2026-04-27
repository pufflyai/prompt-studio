import { apiClient } from "@/features/api-client";

export const removeHarness = async (harnessId: string) => {
  await apiClient().harnesses.delete(harnessId);
};
