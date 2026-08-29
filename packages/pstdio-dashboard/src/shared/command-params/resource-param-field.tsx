import { ParamEditorRow, type SelectionParam } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { type CommandParamFieldProps, commandParamName, useWorkbenchStore } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { buildResourceParamOptions, type ResourceParamOption } from "./resource-param-options";

interface ResourceParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

const selectedOptionId = (options: ResourceParamOption[], value: CommandParamFieldProps["value"]) => {
  if (typeof value !== "string" || value.length === 0) return "";
  try {
    const selected = JSON.parse(value) as { type?: unknown; id?: unknown };
    return (
      options.find((option) => {
        const resource = JSON.parse(option.value) as { type: string; id: string };
        return resource.type === selected.type && resource.id === selected.id;
      })?.id ?? ""
    );
  } catch {
    return "";
  }
};

export const ResourceParamField = (props: ResourceParamFieldProps) => {
  const { entry, value, disabled, onChange, workbench } = props;
  useWorkbenchStore(workbench.resources.store, (state) => state.providers);
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const options = buildResourceParamOptions(workbench.resources.listResources(""), entry.resourceType);
  const resourceParam: SelectionParam = {
    id: entry.key,
    name: commandParamName(entry),
    description: entry.description,
    type: "selection",
    defaultValue: selectedOptionId(options, value),
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      description: option.description,
      icon: option.icon,
    })),
    clearable: !entry.required,
    placeholder: `Select ${entry.label.toLowerCase()}`,
    searchable: options.length > 5,
    searchPlaceholder: `Search ${entry.label.toLowerCase()}…`,
    emptyText: `No ${entry.label.toLowerCase()} available`,
    disabled: disabled || options.length === 0,
  };

  return (
    <ParamEditorRow
      param={resourceParam}
      onChange={(_id, next) => {
        if (typeof next !== "string") return;
        onChange(options.find((option) => option.id === next)?.value ?? "");
      }}
    />
  );
};
