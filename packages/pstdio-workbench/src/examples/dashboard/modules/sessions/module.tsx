import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "../../../../core";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { SessionWidget } from "./components/session-widget";
import { SessionsOverviewWidget } from "./components/sessions-overview-widget";

const registerSessionWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessions,
      title: "Sessions",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.sessions,
      priority: 74,
    },
    { priority: 74 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessions,
    render: (input) => <SessionsOverviewWidget input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.session,
      title: "Session",
      area: "floating",
      singleton: true,
      rendererId: dashboardWidgetIds.session,
      priority: 40,
    },
    { priority: 40 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.session,
    render: (input) => <SessionWidget input={input} />,
  });
};

// The sessions slice: the sessions overview board and the floating session chat.
export const createSessionsModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.sessions",
  activate(ctx) {
    registerSessionWidgets(ctx);

    ctx.resources.registerOpener({
      id: "dashboard.sessions.opener",
      priority: 1000,
      canOpen: (resource) => resource.kind === "dashboard-view" && resource.id === "sessions",
      open: (resource, input) => {
        ctx.modes.setActiveMode("project");
        setResourceBreadcrumb(ctx, resource);
        return ctx.layout.openWidget(dashboardWidgetIds.sessions, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        });
      },
    });
  },
});
