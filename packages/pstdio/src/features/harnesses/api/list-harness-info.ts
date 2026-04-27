import { apiClient } from "@/features/api-client";

export const listHarnessInfo = async () => apiClient().harnesses.info();
