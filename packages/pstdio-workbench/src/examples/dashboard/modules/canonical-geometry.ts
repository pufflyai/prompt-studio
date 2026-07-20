import type { WorkbenchModuleContribution } from "../../../core";
import { dashboardWidgetIds } from "../shared/widget-ids";

const canonicalGeometryRendererId = "dashboard.canonical-geometry";

const canonicalGeometryWidgetIds = {
  mainHeader: "dashboard.canonical-main-header",
  secondaryHeader: "dashboard.canonical-secondary-header",
  secondary: "dashboard.canonical-secondary",
} as const;

export const createCanonicalGeometryModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.canonical-geometry",
  activate(ctx) {
    ctx.renderers.registerRenderer({ id: canonicalGeometryRendererId, render: () => null });

    ctx.layout.registerWidget({
      id: canonicalGeometryWidgetIds.mainHeader,
      title: "Main Panel header",
      region: "main-header",
      rendererId: canonicalGeometryRendererId,
    });
    ctx.layout.registerWidget({
      id: canonicalGeometryWidgetIds.secondaryHeader,
      title: "Secondary Panel header",
      region: "secondary-header",
      rendererId: canonicalGeometryRendererId,
    });
    ctx.layout.registerWidget({
      id: canonicalGeometryWidgetIds.secondary,
      title: "Secondary Panel",
      region: "secondary",
      rendererId: canonicalGeometryRendererId,
    });

    ctx.layout.openWidget(canonicalGeometryWidgetIds.mainHeader, { pinned: true });
    ctx.layout.openWidget(canonicalGeometryWidgetIds.secondaryHeader, { pinned: true });
    ctx.layout.openWidget(canonicalGeometryWidgetIds.secondary, { pinned: true });
    ctx.layout.openWidget(dashboardWidgetIds.session, { pinned: true });
  },
});
