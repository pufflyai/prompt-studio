import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProjectDefaults,
  type UpdateProjectDefaultsInput,
  updateProjectDefaults,
} from "@/shared/projects/project-api";

const queryKey = (projectId: string | undefined) => ["project-defaults", projectId] as const;

export const useProjectDefaults = (projectId: string | undefined) =>
  useQuery({
    queryKey: queryKey(projectId),
    queryFn: () => getProjectDefaults(projectId!),
    enabled: Boolean(projectId),
  });

export const useUpdateProjectDefaults = (projectId: string | undefined) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectDefaultsInput) => updateProjectDefaults(projectId!, input),
    onSuccess: (data) => {
      client.setQueryData(queryKey(projectId), data);
    },
  });
};
