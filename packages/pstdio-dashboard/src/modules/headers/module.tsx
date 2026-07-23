import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectHeader } from "../projects/components/project-header";

const registerHeaders = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: dashboardWidgetIds.projectHeader,
    title: "Project selector",
    region: "nav",
    singleton: true,
    rendererId: dashboardWidgetIds.projectHeader,
  });

  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.projectHeader,
    render: (input) => <ProjectHeader input={input} />,
  });

  ctx.layout.openWidget(dashboardWidgetIds.projectHeader, { pinned: true });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
