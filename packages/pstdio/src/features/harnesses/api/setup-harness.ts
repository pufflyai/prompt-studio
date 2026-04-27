import { apiClient } from "@/features/api-client";

export const setupHarness = async (harnessId: string, binary?: string) =>
  apiClient().harnesses.setup(binary ? { harness_id: harnessId, binary } : { harness_id: harnessId });
