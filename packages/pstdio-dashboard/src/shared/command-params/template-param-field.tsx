import { ParamEditorRow, type SelectionParam } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { type CommandParamFieldProps, commandParamName } from "@pstdio/workbench/react";
import { useQuery } from "@tanstack/react-query";
import { getProjectTemplateAssets } from "@/modules/settings/data/template-provider-api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { buildTemplateParamOptions } from "./template-param-options";

interface TemplateParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

const getStringValue = (value: CommandParamFieldProps["value"]) => (typeof value === "string" ? value : "");

export const projectTemplateAssetsQueryKey = (projectId: string | undefined) => ["project-template-assets", projectId];

export const TemplateParamField = (props: TemplateParamFieldProps) => {
  const { entry, value, disabled, onChange, workbench } = props;
  const projectId = getDashboardSelectedProjectId(workbench);
  const selectedValue = getStringValue(value);
  const { data: templates = [], isLoading } = useQuery({
    queryKey: projectTemplateAssetsQueryKey(projectId),
    queryFn: () => (projectId ? getProjectTemplateAssets(projectId) : Promise.resolve([])),
    enabled: Boolean(projectId),
  });
  const options = buildTemplateParamOptions(templates, entry);

  const templateParam: SelectionParam = {
    id: entry.key,
    name: commandParamName(entry),
    description: entry.description,
    type: "selection",
    defaultValue: selectedValue,
    options: options.map((option) => ({ id: option.value, name: option.label, icon: "FileText" })),
    clearable: !entry.required,
    placeholder: isLoading ? "Loading templates…" : "No template",
    searchable: options.length > 5,
    searchPlaceholder: "Search templates…",
    emptyText: "No templates available",
    disabled: disabled || isLoading,
  };

  return <ParamEditorRow param={templateParam} onChange={(_id, next) => typeof next === "string" && onChange(next)} />;
};
