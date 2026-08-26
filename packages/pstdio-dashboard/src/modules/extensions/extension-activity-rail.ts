import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { createElement } from "react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { ExtensionActivityRailWidget } from "./components/extension-activity-rail";

const contributionRefId = (ref: { extensionId: string; kind: string; id: string }) =>
  ref.extensionId === "pstdio" ? ref.id : `${ref.extensionId}.${ref.kind}.${ref.id}`;

// The rail is dashboard chrome: it opens for modes with extension activity items
// and leaves the region with them, so other modes render no empty rail.
export const registerDashboardActivityRail = (
  ctx: WorkbenchModuleContext,
  getMetadata: () => ResolvedWorkbenchExtensionMetadata | undefined,
) => {
  ctx.layout.registerPanel({
    id: dashboardWidgetIds.activityRail,
    title: "Activity",
    region: "activity",
    singleton: true,
    rendererId: dashboardWidgetIds.activityRail,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.activityRail,
    render: (renderInput) => createElement(ExtensionActivityRailWidget, { input: renderInput }),
  });

  const sync = () => {
    const activeModeId = ctx.modes.getActiveModeId();
    const items = getMetadata()?.activityItems ?? [];
    const hasItems = Boolean(
      activeModeId && items.some((item) => item.modes.some((mode) => contributionRefId(mode) === activeModeId)),
    );
    // Layouts persisted before the rail existed have no activity region entry.
    const placement = ctx.layout
      .getLayout()
      .regions.activity?.widgets.find((widget) => widget.contributionId === dashboardWidgetIds.activityRail);
    if (!hasItems) {
      if (placement) ctx.layout.removeWidgetPlacement(placement.widgetId);
      return;
    }
    ctx.layout.clearRegion("sidenav");
    ctx.layout.openPanel(dashboardWidgetIds.activityRail, { pinned: true });
  };
  const subscription = ctx.modes.onDidChangeActive(sync);

  return { sync, dispose: () => subscription.dispose() };
};
