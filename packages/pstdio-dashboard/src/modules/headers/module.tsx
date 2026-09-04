import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectHeader } from "../projects/components/project-header";

const registerHeaders = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.projectHeader,
    title: "Project selector",
    body: { kind: "react", render: (input) => <ProjectHeader input={input} /> },
  });
  ctx.shellPlacements.registerPlacement({
    id: dashboardWidgetIds.projectHeader,
    item: { kind: "view", viewId: dashboardWidgetIds.projectHeader, presence: "fixed" },
    region: "nav",
  });
};

export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
