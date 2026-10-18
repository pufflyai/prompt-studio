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
  const icon = indicator?.icon ?? resource.icon ?? kind?.icon;
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
    icon: icon ? (
      <WorkbenchIcon
        name={icon}
        color={indicator?.color}
        role={indicator?.label ? "img" : undefined}
        aria-label={indicator?.label}
        aria-hidden={indicator?.label ? undefined : true}
      />
    ) : undefined,
    onActivate: () => {
      onClose();
      void runUserAction(workbench, label, () => activate(resource));
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
