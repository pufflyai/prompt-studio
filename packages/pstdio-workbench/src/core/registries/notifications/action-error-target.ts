import type { WorkbenchCoreContributionContext } from "../../workbench-core-types";

export const actionErrorTarget = (workbench: Pick<WorkbenchCoreContributionContext, "focus" | "layout">) => {
  const region = workbench.focus.getActiveRegion() ?? "main";
  return workbench.layout.getLayout().regions[region].activeWidgetId ?? `region:${region}`;
};
