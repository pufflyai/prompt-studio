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

    ctx.layout.registerPanel({
      closable: false,
      id: canonicalGeometryWidgetIds.mainHeader,
      title: "Main Panel header",
      region: "main-header",
      rendererId: canonicalGeometryRendererId,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: canonicalGeometryWidgetIds.secondaryHeader,
      title: "Secondary Panel header",
      region: "secondary-header",
      rendererId: canonicalGeometryRendererId,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: canonicalGeometryWidgetIds.secondary,
      title: "Secondary Panel",
      region: "secondary",
      rendererId: canonicalGeometryRendererId,
    });

    ctx.layout.openPanel(canonicalGeometryWidgetIds.mainHeader, { pinned: true });
    ctx.layout.openPanel(canonicalGeometryWidgetIds.secondaryHeader, { pinned: true });
    ctx.layout.openPanel(canonicalGeometryWidgetIds.secondary, { pinned: true });
    ctx.layout.openPanel(dashboardWidgetIds.session, { pinned: true });
  },
});
