import type { ResourceRef, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { rememberDashboardSessionResource } from "@/modules/sessions/state/session-selection";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

type SessionBubbleContext = Pick<WorkbenchModuleContributionContext, "context" | "layout" | "panels">;

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  title?: string;
  reveal?: boolean;
}

export const openSessionBubbleWidgets = (ctx: SessionBubbleContext, input: OpenSessionBubbleWidgetsInput = {}) => {
  rememberDashboardSessionResource(ctx, input.resource);

  const bubble = ctx.layout.openWidget(dashboardWidgetIds.sessionBubble, {
    pinned: true,
    resource: input.resource,
    title: input.title ?? input.resource?.label,
  });
  if (input.reveal) {
    ctx.layout.setAreaVisible("side", true);
    ctx.panels.setOpen("side", true);
  }

  return { bubble };
};
