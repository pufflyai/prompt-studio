import { useQuery } from "@tanstack/react-query";
import { projectKeys } from "@/features/project/hooks/keys";
import { listProjectSessions } from "../data/api";

export const useProjectSessions = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.sessions(projectId ?? ""),
    queryFn: () => listProjectSessions(projectId!),
    enabled: Boolean(projectId),
  });
