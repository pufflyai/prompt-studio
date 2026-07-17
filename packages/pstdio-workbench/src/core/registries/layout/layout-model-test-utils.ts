import type { createLayoutModel, WidgetContribution } from "./layout-model";
import type { WorkbenchLayout } from "./layout-types";

export const getTestArea = (layout: WorkbenchLayout, areaId: string) => {
  const area = layout.areas[areaId];
  if (!area) throw new Error(`Missing test area: ${areaId}`);
  return area;
};

export const registerTestWidget = (
  layout: ReturnType<typeof createLayoutModel>,
  widget: Omit<WidgetContribution, "rendererId"> & Partial<Pick<WidgetContribution, "rendererId">>,
) => layout.registerWidget({ rendererId: widget.id, ...widget });
