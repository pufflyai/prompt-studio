import { lazy, Suspense } from "react";
import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "../../../../core";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
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

const registerSessionWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
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

  ctx.layout.registerWidget(
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
