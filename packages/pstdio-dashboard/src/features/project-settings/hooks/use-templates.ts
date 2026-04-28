import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  copyProjectTemplate,
  createProjectTemplate,
  deleteProjectTemplate,
  disableProjectTemplateDefault,
  getProjectTemplate,
  updateProjectTemplate,
} from "@/features/project/data/api";
import type { ProjectTemplateAssetType } from "@/features/project/types";

export const useProjectTemplate = (projectId: string | undefined, name: string | undefined) =>
  useQuery({
    queryKey: ["project-template", projectId, name],
    queryFn: () => getProjectTemplate(projectId!, name!),
    enabled: Boolean(projectId && name),
  });

export const useCreateProjectTemplate = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      templateType: ProjectTemplateAssetType;
      content?: string;
      isDefault?: boolean;
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createProjectTemplate(projectId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-template-assets", projectId] });
    },
  });
};

export const useUpdateProjectTemplate = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; content?: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      await updateProjectTemplate(projectId, input.name, {
        content: input.content,
      });
      return input.name;
    },
    onSuccess: (name) => {
      queryClient.invalidateQueries({ queryKey: ["project-template", projectId, name] });
      queryClient.invalidateQueries({ queryKey: ["project-template-assets", projectId] });
    },
  });
};

export const useDeleteProjectTemplate = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectTemplate(projectId, name);
    },
    onSuccess: (_result, name) => {
      queryClient.invalidateQueries({ queryKey: ["project-template", projectId, name] });
      queryClient.invalidateQueries({ queryKey: ["project-template-assets", projectId] });
    },
  });
};

export const useCopyProjectTemplate = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!projectId) throw new Error("Project id is required.");
      return copyProjectTemplate(projectId, name);
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["project-template", projectId, template.name] });
      queryClient.invalidateQueries({ queryKey: ["project-template-assets", projectId] });
    },
  });
};

export const useDisableProjectTemplateDefault = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!projectId) throw new Error("Project id is required.");
      return disableProjectTemplateDefault(projectId, name);
    },
    onSuccess: (_template, name) => {
      queryClient.invalidateQueries({ queryKey: ["project-template", projectId, name] });
      queryClient.invalidateQueries({ queryKey: ["project-template-assets", projectId] });
    },
  });
};
