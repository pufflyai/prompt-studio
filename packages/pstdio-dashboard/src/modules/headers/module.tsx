import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { useWorkbenchStore, WorkbenchBreadcrumbView, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerCopyPageLink } from "./copy-page-link";

const NavigationHeader = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const showBreadcrumbs = useWorkbenchStore(input.workbench.pages.store, (state) => {
    const main = state.pages[state.activePageId ?? ""]?.main;
    return main?.kind === "view" && main.presentation === "page";
  });
  return showBreadcrumbs ? <WorkbenchBreadcrumbView workbench={input.workbench} /> : null;
};

const registerHeaders = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.projectHeader,
    title: "Project navigation",
    body: {
      kind: "react",
      render: (input) => <NavigationHeader input={input} />,
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
export const createHeadersModule = () =>
  ({
    id: "dashboard.headers",
    activate(ctx) {
      registerHeaders(ctx);
      registerCopyPageLink(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
