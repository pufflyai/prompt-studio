import type { createLayoutModel, WidgetContribution } from "./layout-model";

export const registerTestWidget = (
  layout: ReturnType<typeof createLayoutModel>,
  widget: Omit<WidgetContribution, "rendererId"> & Partial<Pick<WidgetContribution, "rendererId">>,
) => layout.registerWidget({ rendererId: widget.id, ...widget });
