import { apiRequest } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import type { AgentInfo } from "../types";

export const useAgents = () => useFetch(() => apiRequest<AgentInfo[]>("/v1/agents/info"), []);
