import type { CommandParamEntry } from "@pstdio/workbench/react";
import type { ProjectTemplateAsset } from "@/modules/settings/data/template-provider-api";

export const buildTemplateParamOptions = (
  templates: ProjectTemplateAsset[],
  entry: Pick<CommandParamEntry, "templateType">,
) =>
  templates
    .filter((template) => !entry.templateType || template.templateType === entry.templateType)
    .map((template) => ({ label: template.title, value: template.name }));
