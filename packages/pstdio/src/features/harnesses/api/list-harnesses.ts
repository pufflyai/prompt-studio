import { apiClient } from "@/features/api-client";

export const listHarnesses = async () => apiClient().harnesses.list();
