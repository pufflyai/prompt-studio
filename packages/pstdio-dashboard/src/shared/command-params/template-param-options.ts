import type { CommandParamEntry } from "pstdio-workbench/react";
import type { ProjectTemplateAsset } from "@/shared/projects/project-types";

export const buildTemplateParamOptions = (
  templates: ProjectTemplateAsset[],
  entry: Pick<CommandParamEntry, "required" | "templateType">,
) => {
  const options = templates
    .filter((template) => template.enabled !== false)
    .filter((template) => !entry.templateType || template.templateType === entry.templateType)
    .map((template) => ({ label: template.title, value: template.name }));

  return entry.required ? options : [{ label: "Default template", value: "" }, ...options];
};
