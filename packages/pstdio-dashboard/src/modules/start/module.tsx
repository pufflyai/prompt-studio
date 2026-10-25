import { workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  dashboardNavigationSections,
  registerDashboardNavigationContribution,
} from "@/shared/workbench/dashboard-navigation-contribution";
import { setDashboardSidenavSelection } from "@/shared/workbench/dashboard-sidenav";
import { StartWidget } from "./components/start-widget";
import { registerToolResources } from "./tool-resources";

const registerStartWidget = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.start,
      title: "Start",
      body: { kind: "react", render: (input) => <StartWidget input={input} /> },
    },
    { priority: 90 },
  );
};
export const createStartModule = () =>
  ({
    id: "dashboard.start",
    activate(ctx) {
      registerStartWidget(ctx);
      ctx.pages.registerPage({
        id: dashboardViews.start.id,
        ref: workbenchPages.start,
        title: dashboardViews.start.label,
        icon: dashboardViews.start.icon,
        path: "",
        modeId: "project",
        main: {
          kind: "view",
          cardinality: "one",
          presentation: "page",
          view: {
            kind: "view",
            id: dashboardWidgetIds.start,
          },
        },
        slots: [],
      });
      registerDashboardNavigationContribution(ctx, {
        id: "dashboard.start.project-nav",
        modes: ["project"],
        getSections: () => [
          {
            ...dashboardNavigationSections.root,
            nodes: [
              {
                id: dashboardViews.start.id,
                label: "Home",
                icon: dashboardViews.start.icon,
                target: { kind: "page", page: workbenchPages.start },
              },
            ],
          },
        ],
      });
      const unsubscribe = ctx.pages.store.subscribeSelector(
        (state) => state.activePageId,
        (pageId) => {
          if (pageId === dashboardViews.start.id) setDashboardSidenavSelection(ctx, undefined);
        },
      );
      return [{ dispose: unsubscribe }, ...registerToolResources(ctx)];
    },
  }) satisfies WorkbenchModuleContribution;
