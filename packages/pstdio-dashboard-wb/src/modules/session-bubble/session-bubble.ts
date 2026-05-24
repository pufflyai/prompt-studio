import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/commands";
import { rememberDashboardSessionResource } from "../../shared/session/session-selection";
import { dashboardWidgetIds } from "../../shared/widget-ids";

type SessionBubbleContext = Pick<WorkbenchModuleContributionContext, "context" | "layout">;

export const openFloatingSessionCommandId = dashboardCommandIds.openFloatingSession;

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  title?: string;
}

export const openSessionBubbleWidgets = (ctx: SessionBubbleContext, input: OpenSessionBubbleWidgetsInput = {}) => {
  rememberDashboardSessionResource(ctx, input.resource);

  const bubble = ctx.layout.openWidget(dashboardWidgetIds.sessionBubble, {
    pinned: true,
    resource: input.resource,
    title: input.title ?? input.resource?.label,
  });
  const header = ctx.layout.openWidget(dashboardWidgetIds.sessionBubbleHeader, { pinned: true });

  return { bubble, header };
};
