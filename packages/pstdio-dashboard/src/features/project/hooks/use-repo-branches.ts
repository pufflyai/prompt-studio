import { getRepoBranches } from "@/features/project/data/api";
import { useFetch } from "@/lib/use-fetch";

export const useRepoBranches = (repoId?: string | null, options?: { enabled?: boolean }) =>
  useFetch(() => getRepoBranches(repoId ?? ""), [repoId], {
    enabled: (options?.enabled ?? true) && Boolean(repoId),
  });
