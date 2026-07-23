import type {
  ResourceRef,
  WorkbenchModuleContributionContext,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
} from "@pstdio/workbench/core";
import { rememberDashboardSessionResource } from "@/modules/sessions/state/session-selection";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

type SessionBubbleContext = Pick<WorkbenchModuleContributionContext, "context" | "layout">;

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  title?: string;
  replaceWidgetId?: string;
  tabPosition?: WorkbenchTabPosition;
  tabRetention?: WorkbenchTabRetention;
}

export const openSessionBubbleWidgets = (ctx: SessionBubbleContext, input: OpenSessionBubbleWidgetsInput = {}) => {
  rememberDashboardSessionResource(ctx, input.resource);

  const bubble = ctx.layout.openWidget(dashboardWidgetIds.sessionBubble, {
    resource: input.resource,
    title: input.title ?? input.resource?.label,
    replaceWidgetId: input.replaceWidgetId,
    tabPosition: input.tabPosition,
    tabRetention: input.tabRetention,
  });

  return { bubble };
};
