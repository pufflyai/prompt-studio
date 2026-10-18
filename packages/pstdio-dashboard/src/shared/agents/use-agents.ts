import { useQuery } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export const useAgents = (projectId?: string) =>
  useQuery({
    queryKey: ["agents-info", projectId ?? "all"],
    queryFn: () => getApiClient().agents.info({ project: projectId }),
  });
