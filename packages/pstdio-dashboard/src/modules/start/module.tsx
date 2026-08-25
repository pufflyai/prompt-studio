import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { setDashboardSidenavSelection } from "@/shared/workbench/dashboard-sidenav";
import { registerDashboardViewRoute } from "@/shared/workbench/route-helper";
import { StartWidget } from "./components/start-widget";

const registerStartWidget = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.start,
      title: "Start",
      region: "main",
      rendererId: dashboardWidgetIds.start,
      singleton: true,
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
      registerDashboardViewRoute(ctx, {
        id: dashboardViews.start.id,
        mode: "project",
        panelId: dashboardWidgetIds.start,
        title: dashboardViews.start.label,
        icon: dashboardViews.start.icon,
        beforeOpen: () => {
          ctx.breadcrumbs.clearItems();
          setDashboardSidenavSelection(ctx, undefined);
        },
      });
    },
  }) satisfies WorkbenchModuleContribution;
