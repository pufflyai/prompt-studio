import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectSidenavHeader } from "../projects/components/project-sidenav-header";

const registerHeaders = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: dashboardWidgetIds.sidenavHeader,
    title: "Project brand",
    region: "sidenav-header",
    singleton: true,
    rendererId: dashboardWidgetIds.sidenavHeader,
  });

  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sidenavHeader,
    render: (input) => <ProjectSidenavHeader input={input} />,
  });

  ctx.layout.openWidget(dashboardWidgetIds.sidenavHeader, { pinned: true });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
