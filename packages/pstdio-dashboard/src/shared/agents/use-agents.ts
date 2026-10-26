import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";
import { loadAgents } from "./load-agents";

export const useAgents = (projectId?: string) =>
  useQuery({
    queryKey: ["agents-info", projectId ?? "all"],
    queryFn: ({ signal }) => loadAgents(getApiClient().agents, projectId, signal),
    // Extension availability can change in another window.
    refetchInterval: 15_000,
  });
