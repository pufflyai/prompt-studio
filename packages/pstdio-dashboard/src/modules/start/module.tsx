import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { setDashboardSidenavSelection } from "@/shared/workbench/dashboard-sidenav";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { StartWidget } from "./components/start-widget";

const registerStartWidget = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.start,
      title: "Start",
      region: "main",
      rendererId: dashboardWidgetIds.start,
      singleton: true,
      resourceKinds: ["dashboard-view"],
    },
    { priority: 90 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.start,
    render: (input) => <StartWidget input={input} />,
  });
};

export const createStartModule = () =>
  ({
    id: "dashboard.start",
    activate(ctx) {
      registerStartWidget(ctx);
      registerResourceRoute(ctx, {
        id: "dashboard.start.presenter",
        match: (resource) => resource.kind === "dashboard-view" && resource.id === dashboardResources.start.id,
        mode: "project",
        panelId: dashboardWidgetIds.start,
        beforeOpen: ({ resource }) => {
          setResourceBreadcrumb(ctx, resource);
          setDashboardSidenavSelection(ctx, undefined);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
