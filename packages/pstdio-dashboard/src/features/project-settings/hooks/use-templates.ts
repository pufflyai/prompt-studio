import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProjectTemplate,
  deleteProjectTemplate,
  getProjectTemplate,
  updateInstalledExtensionTemplate,
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
    mutationFn: async (input: {
      name: string;
      content?: string;
      installName?: string;
      key?: string;
      sourceKind?: "project" | "extension";
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      if (input.sourceKind === "extension") {
        if (!input.installName || !input.key || input.content === undefined) {
          throw new Error("Extension template source metadata is required.");
        }
        await updateInstalledExtensionTemplate(input.installName, input.key, { content: input.content });
      } else {
        await updateProjectTemplate(projectId, input.name, {
          content: input.content,
        });
      }
      return input.name;
    },
    onSuccess: (name, input) => {
      if (input.sourceKind === "extension") {
        queryClient.invalidateQueries({ queryKey: ["project-template"] });
        queryClient.invalidateQueries({ queryKey: ["project-template-assets"] });
        return;
      }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-template-assets", projectId] });
    },
  });
};
