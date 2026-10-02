import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectHeader } from "../projects/components/project-header";
import type { DesktopProjectTabsController } from "../projects/desktop-project-tabs-controller";
import { DesktopProjectBreadcrumb } from "./components/desktop-project-breadcrumb";

const registerHeaders = (ctx: WorkbenchModuleContext, projectTabs?: DesktopProjectTabsController) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.projectHeader,
    title: projectTabs ? "Project navigation" : "Project selector",
    body: {
      kind: "react",
      render: (input) => (projectTabs ? <DesktopProjectBreadcrumb input={input} /> : <ProjectHeader input={input} />),
    },
  });
  ctx.shellPlacements.registerPlacement({
    id: dashboardWidgetIds.projectHeader,
    item: {
      kind: "view",
      presence: "fixed",
      view: {
        kind: "view",
        id: dashboardWidgetIds.projectHeader,
      },
    },
    region: "nav",
  });
};
export const createHeadersModule = (projectTabs?: DesktopProjectTabsController) =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx, projectTabs);
    },
  }) satisfies WorkbenchModuleContribution;
