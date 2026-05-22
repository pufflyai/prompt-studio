import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "../../shared/widget-ids";

export const openFloatingSessionCommandId = "dashboard.openFloatingSession";

type SessionBubbleContext = Pick<WorkbenchModuleContributionContext, "layout">;

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  title?: string;
}

export const openSessionBubbleWidgets = (ctx: SessionBubbleContext, input: OpenSessionBubbleWidgetsInput = {}) => {
  const bubble = ctx.layout.openWidget(dashboardWidgetIds.sessionBubble, {
    pinned: true,
    resource: input.resource,
    title: input.title ?? input.resource?.label,
  });
  const header = ctx.layout.openWidget(dashboardWidgetIds.sessionBubbleHeader, { pinned: true });

  return { bubble, header };
};
