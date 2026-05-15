import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentInfo } from "../types";

export const useAgents = () =>
  useQuery({
    queryKey: ["agents-info"],
    queryFn: () => apiRequest<AgentInfo[]>("/v1/agents/info"),
  });
