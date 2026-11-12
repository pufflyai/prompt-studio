import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { WorkbenchBreadcrumbView } from "@pstdio/workbench/react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectHeader } from "../projects/components/project-header";
import type { DesktopProjectTabs } from "../projects/project-selection-sync";
import { registerCopyPageLink } from "./copy-page-link";

const registerHeaders = (ctx: WorkbenchModuleContext, projectTabs?: DesktopProjectTabs) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.projectHeader,
    title: projectTabs ? "Project navigation" : "Project selector",
    body: {
      kind: "react",
      render: (input) =>
        projectTabs ? <WorkbenchBreadcrumbView workbench={input.workbench} /> : <ProjectHeader input={input} />,
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
export const createHeadersModule = (projectTabs?: DesktopProjectTabs) =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx, projectTabs);
      registerCopyPageLink(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
