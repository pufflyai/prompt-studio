import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentInfo } from "./agent-types";

export const useAgents = (projectId?: string) =>
  useQuery({
    queryKey: ["agents-info", projectId ?? "all"],
    queryFn: () =>
      apiRequest<AgentInfo[]>(
        projectId ? `/v1/agents/info?project=${encodeURIComponent(projectId)}` : "/v1/agents/info",
      ),
  });
