import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardHomePage } from "@/shared/app/resources";
import {
  dashboardNavigationSections,
  registerDashboardNavigationContribution,
} from "@/shared/workbench/dashboard-navigation-contribution";
import { setDashboardSidenavSelection } from "@/shared/workbench/dashboard-sidenav";

const registerHomeWidget = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView(
    {
      id: "test.home",
      title: "Home",
      body: { kind: "react", render: () => null },
    },
    { priority: 90 },
  );
};
export const createHomeModule = () =>
  ({
    id: "test.home",
    activate(ctx) {
      registerHomeWidget(ctx);
      ctx.pages.registerPage({
        id: "pstdio.home.page.home",
        ref: dashboardHomePage,
        title: "Home",
        icon: "house",
        path: "home",
        modeId: "project",
        main: {
          kind: "view",
          cardinality: "one",
          presentation: "page",
          view: {
            kind: "view",
            id: "test.home",
          },
        },
        slots: [],
      });
      ctx.keybindings.registerKeybinding({
        action: { kind: "page", page: dashboardHomePage },
        keybinding: "H",
        layer: "go",
        label: "Go to home",
      });
      registerDashboardNavigationContribution(ctx, {
        id: "dashboard.start.project-nav",
        modes: ["project"],
        getSections: () => [
          {
            ...dashboardNavigationSections.root,
            nodes: [
              {
                id: "pstdio.home.page.home",
                label: "Home",
                icon: "house",
                target: { kind: "page", page: dashboardHomePage },
              },
            ],
          },
        ],
      });
      const unsubscribe = ctx.pages.store.subscribeSelector(
        (state) => state.activePageId,
        (pageId) => {
          if (pageId === "pstdio.home.page.home") setDashboardSidenavSelection(ctx, undefined);
        },
      );
      return [{ dispose: unsubscribe }];
    },
  }) satisfies WorkbenchModuleContribution;
