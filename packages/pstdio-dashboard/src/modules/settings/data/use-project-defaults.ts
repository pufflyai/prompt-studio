import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectDefaults } from "@/shared/projects/project-api";
import type { ProjectDefaultPatch } from "@/shared/projects/project-default-operations";
import { getProjectDefaultOperations, useProjectedProjectDefaults } from "@/shared/projects/synced-project-defaults";

const queryKey = (projectId: string | undefined) => ["project-defaults", projectId] as const;

export const useProjectDefaults = (projectId: string | undefined) => {
  const query = useQuery({
    queryKey: queryKey(projectId),
    queryFn: ({ signal }) => getProjectDefaults(projectId!, signal),
    enabled: Boolean(projectId),
  });
  const data = useProjectedProjectDefaults(projectId, query.data);
  return { ...query, data };
};

export const useUpdateProjectDefaults = (projectId: string) => {
  const client = useQueryClient();
  const operations = getProjectDefaultOperations();
  return useMutation({
    mutationFn: (patch: ProjectDefaultPatch) =>
      operations.update(projectId, patch, (project) => {
        // Prevent an earlier fetch from overwriting the accepted post-write read.
        void client.cancelQueries({ queryKey: queryKey(projectId), exact: true });
        client.setQueryData(queryKey(projectId), project);
      }),
  });
};
