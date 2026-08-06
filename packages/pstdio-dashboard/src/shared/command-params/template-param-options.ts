import type { CommandParamEntry } from "@pstdio/workbench/react";
import type { ProjectTemplateAsset } from "@/shared/projects/project-types";

// Templates are optional; the field clears back to "no template" by re-picking the
// selected one, so the option list carries only the real, enabled templates.
export const buildTemplateParamOptions = (
  templates: ProjectTemplateAsset[],
  entry: Pick<CommandParamEntry, "templateType">,
) =>
  templates
    .filter((template) => template.enabled !== false)
    .filter((template) => !entry.templateType || template.templateType === entry.templateType)
    .map((template) => ({ label: template.title, value: template.name }));
