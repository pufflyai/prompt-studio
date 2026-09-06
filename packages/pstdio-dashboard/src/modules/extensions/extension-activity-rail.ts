import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { createElement } from "react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { toWorkbenchContributionId } from "@/shared/extensions/contribution-ref";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { ExtensionActivityRailWidget } from "./components/extension-activity-rail";
// The rail is dashboard chrome: it opens for modes with extension activity items
// and leaves the region with them, so other modes render no empty rail.
export const registerDashboardActivityRail = (
  ctx: WorkbenchModuleContext,
  getMetadata: () => ResolvedWorkbenchExtensionMetadata | undefined,
) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.activityRail,
    title: "Activity",
    body: {
      kind: "react",
      render: (renderInput) => createElement(ExtensionActivityRailWidget, { input: renderInput }),
    },
  });
  ctx.shellPlacements.registerPlacement({
    id: dashboardWidgetIds.activityRail,
    item: {
      kind: "view",
      presence: "closed",
      view: {
        kind: "view",
        id: dashboardWidgetIds.activityRail,
      },
    },
    region: "activity",
  });
  const sync = () => {
    const activeModeId = ctx.modes.getActiveModeId();
    const items = getMetadata()?.activityItems ?? [];
    const hasItems = Boolean(
      activeModeId && items.some((item) => item.modes.some((mode) => toWorkbenchContributionId(mode) === activeModeId)),
    );
    // Layouts persisted before the rail existed have no activity region entry.
    const placement = ctx.layout
      .getLayout()
      .regions.activity?.widgets.find(
        (widget) =>
          widget.placementIdentity?.kind === "shell" &&
          widget.placementIdentity.placementId === dashboardWidgetIds.activityRail,
      );
    if (!hasItems) {
      if (placement?.placementIdentity) ctx.shellPlacements.closePlacement(placement.placementIdentity);
      return;
    }
    if (placement) return;
    void ctx.navigation.openPanel({ panel: { kind: "shell-placement", id: dashboardWidgetIds.activityRail } });
  };
  const modeSubscription = ctx.modes.onDidChangeActive(sync);
  // Page navigation publishes the mode before it reconciles the page layout.
  // Reapply mode chrome after that layout commit so the page cannot erase it.
  const pageSubscription = ctx.pages.store.subscribe(sync);
  return {
    sync,
    dispose: () => {
      pageSubscription();
      modeSubscription.dispose();
    },
  };
};
