import { lazy, Suspense } from "react";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "../../../../core";
import { dashboardViews } from "../../shared/mock-data/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";

const SessionWidget = lazy(() =>
  import("./components/session-widget").then((module) => ({
    default: module.SessionWidget,
  })),
);

const SessionsOverviewWidget = lazy(() =>
  import("./components/sessions-overview-widget").then((module) => ({
    default: module.SessionsOverviewWidget,
  })),
);

const registerSessionWidgets = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.sessions,
      title: "Sessions",
      region: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.sessions,
      priority: 74,
    },
    { priority: 74 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessions,
    render: (input) => (
      <Suspense fallback={null}>
        <SessionsOverviewWidget input={input} />
      </Suspense>
    ),
  });

  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.session,
      title: "Session",
      region: "side",
      singleton: true,
      rendererId: dashboardWidgetIds.session,
      priority: 40,
    },
    { priority: 40 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.session,
    render: (input) => (
      <Suspense fallback={null}>
        <SessionWidget input={input} />
      </Suspense>
    ),
  });
};

// The sessions slice: the sessions overview board and the Side Panel session chat.
export const createSessionsModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.sessions",
  activate(ctx) {
    registerSessionWidgets(ctx);

    ctx.views.registerView({
      id: dashboardViews.sessions.id,
      panelId: dashboardWidgetIds.sessions,
      title: dashboardViews.sessions.label,
      icon: dashboardViews.sessions.icon,
      resolveInput: (input) => {
        ctx.modes.setActiveMode("project");
        ctx.breadcrumbs.setItems([{ title: dashboardViews.sessions.label, icon: dashboardViews.sessions.icon }]);
        return input;
      },
    });
  },
});
