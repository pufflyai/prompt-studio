import { resourceKey } from "@pstdio/sdk/extensions";
import type { PaletteEntry } from "@pstdio/ui";
import type { ResourceBrowseEntry, WorkbenchCore } from "../../core";
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
  const kind = workbench.resources.getKind(resource.type);
  const icon = resource.icon ?? kind?.icon;
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
    icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
    onActivate: () => {
      onClose();
      void Promise.resolve(activate(resource)).catch(() => undefined);
    },
  };
};
export const createWorkbenchResourcePaletteEntries = (input: {
  workbench: WorkbenchCore;
  query: string;
  onClose: () => void;
}) => {
  const { onClose, query, workbench } = input;
  return workbench.resources
    .listResources(query)
    .map((entry) => createResourceEntry({ workbench, entry, onClose }))
    .filter((entry): entry is WorkbenchResourcePaletteEntry => entry !== undefined);
};
