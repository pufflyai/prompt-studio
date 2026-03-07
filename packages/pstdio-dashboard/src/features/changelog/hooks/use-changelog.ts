import { useQuery } from "@tanstack/react-query";
import { getChangelog } from "../data/api";

const changelogKeys = {
  all: (projectId?: string) => ["changelog", projectId ?? "global"] as const,
};

export const useChangelog = (projectId?: string) =>
  useQuery({
    queryKey: changelogKeys.all(projectId),
    queryFn: () => getChangelog(projectId),
  });
