import { apiClient } from "@/features/api-client";

export const listAgents = async () => apiClient().agents.list();
