import type { WorkbenchArea, WorkbenchCore } from "../../core";

export const getHeaderBorderBottomWidth = (workbench: WorkbenchCore, area: WorkbenchArea) =>
  workbench.layout.getAreaHeaderBorderBottom(area) ? "1px" : "0";
