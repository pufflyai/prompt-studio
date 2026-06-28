import type { PaletteEntry } from "@pstdio/ui";
import type { ResourceBrowseEntry, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { SEARCH_MODE_ID } from "./palette-view";

export interface WorkbenchResourcePaletteEntry extends PaletteEntry {
  resourceUri: string;
  mode: typeof SEARCH_MODE_ID;
}

const createResourceEntry = (input: {
  workbench: WorkbenchCore;
  entry: ResourceBrowseEntry;
  onClose: () => void;
}): WorkbenchResourcePaletteEntry => {
  const { entry, onClose, workbench } = input;
  const { resource } = entry;
  const label = entry.resource.label ?? entry.resource.uri;
  const kind = workbench.resources.getKind(resource.kind);
  const icon = resource.icon ?? kind?.icon;

  return {
    id: `workbench-resource:${resource.uri}`,
    resourceUri: resource.uri,
    mode: SEARCH_MODE_ID,
    label,
    searchText: entry.searchText ?? label,
    description: entry.description,
    group: entry.group,
    icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
    onActivate: () => {
      onClose();
      void Promise.resolve(
        entry.activate ? entry.activate(resource) : workbench.resources.openResource(resource, kind?.paletteOpenInput),
      ).catch(() => undefined);
    },
  };
};

export const createWorkbenchResourcePaletteEntries = (input: {
  workbench: WorkbenchCore;
  query: string;
  onClose: () => void;
}) => {
  const { onClose, query, workbench } = input;
  return workbench.resources.listResources(query).map((entry) => createResourceEntry({ workbench, entry, onClose }));
};
