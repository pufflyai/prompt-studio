import type { WorkbenchCore, WorkbenchRegion } from "../../core";

export const resolvePanelCollapsible = (workbench: WorkbenchCore, ...regions: WorkbenchRegion[]) =>
  regions.every((region) => workbench.layout.getRegionCollapsible(region));
