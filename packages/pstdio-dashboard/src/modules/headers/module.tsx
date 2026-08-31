import { workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectNameContextKey } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardNavigationContribution } from "@/shared/workbench/dashboard-navigation-contribution";
import { ProjectHeader } from "../projects/components/project-header";

const registerHeaders = (ctx: WorkbenchModuleContext) => {
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.project-context",
    modes: ["*"],
    slot: "header",
    getSections: () => [
      {
        id: "navigation.project-context",
        nodes: [
          {
            id: "dashboard.project-context",
            label: String(ctx.context.get(dashboardSelectedProjectNameContextKey) ?? "Project"),
            icon: "folder-kanban",
            target: { kind: "page", page: workbenchPages.start },
            actions: [
              {
                id: "switch-project",
                label: "Switch project",
                icon: "chevrons-up-down",
                commandId: dashboardCommandIds.openProjects,
              },
            ],
          },
        ],
      },
    ],
  });

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
