import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteProjectTemplate, getProjectTemplate, updateProjectTemplate } from "@/shared/projects/project-api";

const templateQueryKey = (projectId: string, name: string) => ["project-template", projectId, name];

export const useProjectTemplate = (projectId: string, name: string) =>
  useQuery({
    queryKey: templateQueryKey(projectId, name),
    queryFn: () => getProjectTemplate(projectId, name),
  });

export const useUpdateProjectTemplate = (projectId: string, name: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => updateProjectTemplate(projectId, name, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateQueryKey(projectId, name) }),
  });
};

export const useDeleteProjectTemplate = (projectId: string) =>
  useMutation({
    mutationFn: (name: string) => deleteProjectTemplate(projectId, name),
  });
