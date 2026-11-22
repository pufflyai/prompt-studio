import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { useWorkbenchStore, WorkbenchBreadcrumbView, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { ProjectHeader } from "../projects/components/project-header";
import type { DesktopProjectTabs } from "../projects/project-selection-sync";
import { registerCopyPageLink } from "./copy-page-link";

const NavigationHeader = (props: { input: WorkbenchPanelRenderInput; projectTabs: boolean }) => {
  const { input, projectTabs } = props;
  const showBreadcrumbs = useWorkbenchStore(input.workbench.pages.store, (state) => {
    const main = state.pages[state.activePageId ?? ""]?.main;
    return main?.kind === "view" && main.presentation === "page";
  });
  if (projectTabs) return showBreadcrumbs ? <WorkbenchBreadcrumbView workbench={input.workbench} /> : null;
  return <ProjectHeader input={input} showBreadcrumbs={showBreadcrumbs} />;
};

const registerHeaders = (ctx: WorkbenchModuleContext, projectTabs?: DesktopProjectTabs) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.projectHeader,
    title: projectTabs ? "Project navigation" : "Project selector",
    body: {
      kind: "react",
      render: (input) => <NavigationHeader input={input} projectTabs={Boolean(projectTabs)} />,
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
