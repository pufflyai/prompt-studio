import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProjectTemplate,
  getProjectTemplate,
  type ProjectTemplateAsset,
  saveProjectTemplate,
} from "./template-provider-api";

const templateQueryKey = (template: ProjectTemplateAsset) => ["project-template", template.projectId, template.id];

export const useProjectTemplate = (template: ProjectTemplateAsset) =>
  useQuery({
    queryKey: templateQueryKey(template),
    queryFn: () => getProjectTemplate(template),
  });

export const useUpdateProjectTemplate = (template: ProjectTemplateAsset) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => saveProjectTemplate(template, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateQueryKey(template) }),
  });
};

export const useDeleteProjectTemplate = () =>
  useMutation({
    mutationFn: deleteProjectTemplate,
  });
