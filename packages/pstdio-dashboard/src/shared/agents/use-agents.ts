import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export const useAgents = (projectId?: string) =>
  useQuery({
    queryKey: ["agents-info", projectId ?? "all"],
    queryFn: () =>
      getApiClient()
        .agents.query(projectId)
        .then((page) => page.items),
    // Extension availability can change in another window.
    refetchInterval: 15_000,
  });
