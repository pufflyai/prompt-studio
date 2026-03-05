import { useQuery } from "@tanstack/react-query";

import { getRepoBranches } from "@/features/project/data/api";

export const repoBranchKeys = {
  all: ["repoBranches"] as const,
  byRepo: (repoId: string | undefined) => ["repoBranches", repoId] as const,
};

export const useRepoBranches = (repoId?: string | null, options?: { enabled?: boolean }) => {
  const enabled = (options?.enabled ?? true) && Boolean(repoId);

  return useQuery({
    queryKey: repoBranchKeys.byRepo(repoId ?? undefined),
    queryFn: () => getRepoBranches(repoId ?? ""),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
};
