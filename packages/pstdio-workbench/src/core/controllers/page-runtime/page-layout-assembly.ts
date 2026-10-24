import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-types";
import { restorePageHeaders } from "./page-header-layout";

export const assemblePageLayout = (
  layout: WorkbenchLayout | undefined,
  main: WorkbenchLayout | undefined,
  headers: WorkbenchLayout | undefined,
) => {
  if (!layout && !main && !headers) return undefined;
  const base = layout ?? createDefaultWorkbenchLayout();
  const mainIds = new Set(main?.regions.main.widgets.map((tab) => tab.widgetId));
  return restorePageHeaders(
    {
      ...base,
      regions: {
        ...base.regions,
        main: main?.regions.main ?? { ...base.regions.main, widgets: [], activeWidgetId: undefined },
      },
      activeWidgetId: mainIds.has(main?.activeWidgetId ?? "") ? main?.activeWidgetId : base.activeWidgetId,
      activeLocationWidgetId: mainIds.has(main?.activeLocationWidgetId ?? "")
        ? main?.activeLocationWidgetId
        : base.activeLocationWidgetId,
    },
    headers,
  );
};
