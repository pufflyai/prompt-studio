import type {
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
} from "@pstdio/workbench";
import { rememberDashboardSessionResource } from "@/modules/sessions/state/session-selection";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

type SessionBubbleContext = Pick<WorkbenchModuleContext, "context" | "layout">;

interface OpenSessionBubbleWidgetsInput {
  resource?: ResourceRef;
  title?: string;
  replaceWidgetId?: string;
  tabPosition?: WorkbenchTabPosition;
  tabRetention?: WorkbenchTabRetention;
}

const sessionOpenStrategy = (input: OpenSessionBubbleWidgetsInput) => {
  if (input.replaceWidgetId) return { kind: "replace-panel" as const, instanceId: input.replaceWidgetId };
  if (input.tabRetention === "preview") return { kind: "preview" as const, position: input.tabPosition };
  return { kind: "activate-or-open" as const, position: input.tabPosition };
};

export const openSessionBubbleWidgets = (ctx: SessionBubbleContext, input: OpenSessionBubbleWidgetsInput = {}) => {
  rememberDashboardSessionResource(ctx, input.resource);

  const bubble = ctx.layout.openPanel(dashboardWidgetIds.sessionBubble, {
    resource: input.resource,
    title: input.title ?? input.resource?.label,
    strategy: sessionOpenStrategy(input),
  });

  return { bubble };
};
