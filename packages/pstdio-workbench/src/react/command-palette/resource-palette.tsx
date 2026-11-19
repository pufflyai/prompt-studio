import { resourceKey } from "@pstdio/sdk/extensions";
import type { PaletteEntry } from "@pstdio/ui";
import type { ResourceBrowseEntry, WorkbenchCore } from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";
import { WorkbenchIcon } from "../shared/icon";
import { SEARCH_MODE_ID } from "./palette-view";
export interface WorkbenchResourcePaletteEntry extends PaletteEntry {
  resourceKey: string;
  mode: typeof SEARCH_MODE_ID;
}
export const WorkbenchResourcePaletteIcon = (props: {
  icon?: string;
  iconColor?: string;
  iconLabel?: string;
  indicator?: ResourceBrowseEntry["indicator"];
}) => {
  const { indicator } = props;
  const icon = indicator?.icon ?? props.icon;
  const color = indicator ? indicator.color : props.iconColor;
  const label = indicator ? indicator.label : props.iconLabel;
  return icon ? (
    <WorkbenchIcon
      name={icon}
      color={color}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  ) : null;
};
const createResourceEntry = (input: {
  workbench: WorkbenchCore;
  entry: ResourceBrowseEntry;
  onClose: () => void;
}): WorkbenchResourcePaletteEntry | undefined => {
  const { entry, onClose, workbench } = input;
  const { resource } = entry;
  const label = entry.resource.label ?? resourceKey(entry.resource);
  const kind = workbench.resources.getKind(resource.type, resource.extensionId);
  const indicator = entry.indicator;
  const icon = resource.icon ?? indicator?.icon ?? kind?.icon;
  const activate = entry.activate;
  if (!activate) return undefined;
  return {
    id: `workbench-resource:${resourceKey(resource)}`,
    resourceKey: resourceKey(resource),
    mode: SEARCH_MODE_ID,
    label,
    searchText: entry.searchText ?? label,
    description: entry.description,
    group: entry.group,
    icon: (
      <WorkbenchResourcePaletteIcon
        icon={icon}
        iconColor={resource.iconColor}
        iconLabel={resource.iconLabel}
        indicator={indicator}
      />
    ),
    onActivate: () => {
      void runUserAction(workbench, label, () => activate(resource), {
        inlineTarget: "command-palette",
        onSuccess: onClose,
      });
    },
  };
};
export const createWorkbenchResourcePaletteEntries = (input: {
  workbench: WorkbenchCore;
  query: string;
  onClose: () => void;
  resources?: readonly ResourceBrowseEntry[];
}) => {
  const { onClose, query, workbench } = input;
  return (input.resources ?? workbench.resources.listResources(query))
    .map((entry) => createResourceEntry({ workbench, entry, onClose }))
    .filter((entry): entry is WorkbenchResourcePaletteEntry => entry !== undefined);
};
