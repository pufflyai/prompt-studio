import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/features/project/hooks/keys";
import { createProject, deleteProject, getProjects } from "../data/api";

export const useProjectList = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: projectKeys.all,
    queryFn: getProjects,
    enabled,
    select: (projects) =>
      [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId }: { projectId: string }) => deleteProject(projectId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.removeQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.removeQueries({ queryKey: projectKeys.tickets(variables.projectId) });
      queryClient.removeQueries({ queryKey: projectKeys.sessions(variables.projectId) });
    },
  });
};
