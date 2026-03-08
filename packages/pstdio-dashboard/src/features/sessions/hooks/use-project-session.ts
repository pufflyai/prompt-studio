import { useQuery } from "@tanstack/react-query";
import { projectKeys } from "@/features/project/hooks/keys";
import { getSession } from "../data/api";

export const useProjectSession = (projectId: string | undefined, sessionId: string | null) =>
  useQuery({
    queryKey: projectKeys.session(projectId ?? "", sessionId ?? ""),
    queryFn: () => getSession(sessionId!),
    enabled: Boolean(projectId) && Boolean(sessionId),
  });
