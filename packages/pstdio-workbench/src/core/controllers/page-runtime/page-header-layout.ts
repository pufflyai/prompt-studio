import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-types";
import type { WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";

const panelRegions = ["main", "side", "secondary"] as const;
const headerScope = (context: WorkbenchPagePersistenceScopeInput) =>
  `workbench-page-headers:${JSON.stringify([context.projectId, context.pageId])}`;

export const createPageHeaderCache = (input: {
  read(scope: string): WorkbenchLayout | undefined;
  write(layout: WorkbenchLayout, scope: string): unknown;
  clear(scope: string, fallback: WorkbenchLayout): void;
}) => ({
  load: (context: WorkbenchPagePersistenceScopeInput) => input.read(headerScope(context)),
  save(context: WorkbenchPagePersistenceScopeInput, layout: WorkbenchLayout) {
    const scope = headerScope(context);
    const previous = input.read(scope);
    if (panelRegions.every((id) => previous?.regions[id].headerVisible === layout.regions[id].headerVisible)) return;
    // Header preferences must not become another owner of the page's open tabs.
    const snapshot = createDefaultWorkbenchLayout();
    for (const id of panelRegions) snapshot.regions[id].headerVisible = layout.regions[id].headerVisible;
    if (panelRegions.some((id) => snapshot.regions[id].headerVisible !== undefined)) input.write(snapshot, scope);
    else input.clear(scope, snapshot);
  },
});

export const restorePageHeaders = (layout: WorkbenchLayout, headers: WorkbenchLayout | undefined) => {
  const regions = { ...layout.regions };
  for (const id of panelRegions) regions[id] = { ...regions[id], headerVisible: headers?.regions[id].headerVisible };
  return { ...layout, regions };
};
