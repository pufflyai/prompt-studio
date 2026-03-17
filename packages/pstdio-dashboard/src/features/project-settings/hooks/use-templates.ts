import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createProjectTemplate,
  deleteProjectTemplate,
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

export const useCreateProjectTemplate = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: {
      name: string;
      templateType: ProjectTemplateAssetType;
      content?: string;
      isDefault?: boolean;
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createProjectTemplate(projectId, input);
    },
  });

export const useUpdateProjectTemplate = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { name: string; content?: string; isDefault?: boolean }) => {
      if (!projectId) throw new Error("Project id is required.");
      await updateProjectTemplate(projectId, input.name, {
        content: input.content,
        isDefault: input.isDefault,
      });
    },
  });

export const useDeleteProjectTemplate = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (name: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectTemplate(projectId, name);
    },
  });
