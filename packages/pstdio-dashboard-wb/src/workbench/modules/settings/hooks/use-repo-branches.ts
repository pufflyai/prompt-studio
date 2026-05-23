import { useQuery } from "@tanstack/react-query";
import { getRepoBranches } from "../data/project-api";

export const useRepoBranches = (repoId?: string | null, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["repo-branches", repoId],
    queryFn: () => getRepoBranches(repoId ?? ""),
    enabled: (options?.enabled ?? true) && Boolean(repoId),
  });
