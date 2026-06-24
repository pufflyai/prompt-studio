import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { setDashboardSidebarSelection } from "@/shared/workbench/dashboard-sidebar";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { StartWidget } from "./components/start-widget";

const registerStartWidget = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.start,
      title: "Start",
      area: "main",
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
        id: "dashboard.start.opener",
        match: (resource) => resource.kind === "dashboard-view" && resource.id === dashboardResources.start.id,
        mode: "project",
        widgetId: dashboardWidgetIds.start,
        beforeOpen: ({ resource }) => {
          setResourceBreadcrumb(ctx, resource);
          setDashboardSidebarSelection(ctx, undefined);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
