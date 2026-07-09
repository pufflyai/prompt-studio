import type { CommandParamEntry } from "@pstdio/workbench/react";
import type { ProjectTemplateAsset } from "@/shared/projects/project-types";

// Templates are optional; the field renders an explicit "None" choice and defaults to
// it, so the option list carries only the real, enabled templates.
export const buildTemplateParamOptions = (
  templates: ProjectTemplateAsset[],
  entry: Pick<CommandParamEntry, "templateType">,
) =>
  templates
    .filter((template) => template.enabled !== false)
    .filter((template) => !entry.templateType || template.templateType === entry.templateType)
    .map((template) => ({ label: template.title, value: template.name }));
