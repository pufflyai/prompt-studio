import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectHeader } from "../projects/components/project-header";

const registerHeaders = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
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

  ctx.layout.openPanel(dashboardWidgetIds.projectHeader, { pinned: true });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
