import { useQuery } from "@tanstack/react-query";
import { getProjectPlugins } from "../data/plugins-api";

export const useProjectPlugins = (projectId: string | undefined) =>
  useQuery({
    queryKey: ["project-plugins", projectId],
    queryFn: () => getProjectPlugins(projectId!),
    enabled: Boolean(projectId),
  });
