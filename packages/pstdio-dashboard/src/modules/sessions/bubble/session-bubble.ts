import type { ResourceRef, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { rememberDashboardSessionResource } from "@/modules/sessions/state/session-selection";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

type SessionBubbleContext = Pick<WorkbenchModuleContributionContext, "context" | "layout">;

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

  return { bubble };
};
