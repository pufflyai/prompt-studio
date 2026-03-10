import { useQuery } from "@tanstack/react-query";
import { getChangelog } from "../data/api";

export const useChangelog = (projectId?: string) =>
  useQuery({
    queryKey: ["changelog", projectId],
    queryFn: () => getChangelog(projectId),
  });
