import { executeExtensionCommand } from "@/shared/extensions/api";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

export interface ProjectTemplateAsset {
  id: string;
  projectId: string;
  name: string;
  title: string;
  templateType: string;
  localType: string;
  groupLabel: string;
  groupOrder: number;
  commands: { list: string; read: string; save: string; delete: string };
}

interface TemplateSummary {
  name: string;
  title: string;
  type: string;
}

interface TemplateContent extends TemplateSummary {
  content: string;
}

export const templateTypesForProject = (projectId: string) =>
  [...(getCachedDashboardExtensionMetadata(projectId)?.templateTypes ?? [])]
    .filter((type) => type.commands)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));

const commandValue = async <T>(projectId: string, commandId: string, params: Record<string, unknown>) => {
  const response = await executeExtensionCommand(projectId, commandId, { params });
  if (!response.outcome.ok) {
    throw new Error(response.outcome.error?.message ?? response.outcome.reason ?? `Command failed: ${commandId}`);
  }
  return response.outcome.value as T;
};

export const getProjectTemplateAssets = async (projectId: string) => {
  const types = templateTypesForProject(projectId);
  const summariesByListCommand = new Map<string, Promise<TemplateSummary[]>>();
  return (
    await Promise.all(
      types.map(async (type) => {
        const commands = type.commands!;
        let summaries = summariesByListCommand.get(commands.list);
        if (!summaries) {
          summaries = commandValue<TemplateSummary[]>(projectId, commands.list, {});
          summariesByListCommand.set(commands.list, summaries);
        }
        return (await summaries)
          .filter((template) => template.type === type.localId)
          .map(
            (template): ProjectTemplateAsset => ({
              id: `${type.id}:${template.name}`,
              projectId,
              name: template.name,
              title: template.title,
              templateType: type.id,
              localType: type.localId,
              groupLabel: type.label,
              groupOrder: type.order ?? 0,
              commands,
            }),
          );
      }),
    )
  ).flat();
};

export const getProjectTemplate = (template: ProjectTemplateAsset) =>
  commandValue<TemplateContent | null>(template.projectId, template.commands.read, { name: template.name });

export const saveProjectTemplate = (template: ProjectTemplateAsset, content: string) =>
  commandValue<TemplateContent>(template.projectId, template.commands.save, {
    name: template.name,
    title: template.title,
    type: template.localType,
    content,
  });

export const createProjectTemplate = async (projectId: string, existingNames: string[], templateTypeId: string) => {
  const type = templateTypesForProject(projectId).find((candidate) => candidate.id === templateTypeId);
  if (!type?.commands) throw new Error("No extension provides editable templates.");
  const taken = new Set(existingNames);
  let name = "new-template";
  let index = 2;
  while (taken.has(name)) {
    name = `new-template-${index}`;
    index += 1;
  }
  return commandValue(projectId, type.commands.save, {
    name,
    title: `New ${type.label.toLowerCase()} template`,
    type: type.localId,
    content: "",
  });
};

export const deleteProjectTemplate = (template: ProjectTemplateAsset) =>
  commandValue(template.projectId, template.commands.delete, { name: template.name });
