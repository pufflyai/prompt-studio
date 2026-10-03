import {
  type Disposable,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, WORKBENCH_SETTINGS_WIDGET_ID } from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { DeveloperToolsPanel } from "./components/developer-tools-panel";
import { PerformanceView } from "./components/performance-view";
import { createPerformanceHost } from "./performance-host";
import { createPerformanceMonitoringController } from "./performance-monitoring-controller";

const SETTINGS_PANEL_ID = "performance";
const SETTINGS_VIEW_ID = "dashboard.settings.performance";

const closeSettings = (ctx: WorkbenchModuleContext) => {
  for (const placement of ctx.layout.getLayout().regions.overlay.widgets) {
    if (placement.viewId === WORKBENCH_SETTINGS_WIDGET_ID) ctx.overlays.closeOverlay(placement.widgetId);
  }
};

const closePerformancePanel = (ctx: WorkbenchModuleContext) => {
  for (const placement of ctx.layout.getLayout().regions.secondary.widgets) {
    const identity = placement.placementIdentity;
    if (identity?.kind === "shell" && identity.placementId === dashboardWidgetIds.performance) {
      ctx.shellPlacements.closePlacement(identity);
    }
  }
};

// Developer tools: the device-local performance switch, the live view in the
// Secondary Panel, and commands that open the view or copy its snapshot.
export const createPerformanceModule = () =>
  ({
    id: "dashboard.performance",
    activate(ctx) {
      const bridge = (globalThis as { promptStudioDesktop?: unknown }).promptStudioDesktop;
      const controller = createPerformanceMonitoringController(
        createPerformanceHost(bridge, resolveDashboardStorage(undefined)),
      );
      void controller.load();

      // The view is a Secondary Panel option only while monitoring is on, so the
      // panel's Add menu stays unchanged for everyone who has not opted in.
      let placement: Disposable | undefined;
      const syncPlacement = () => {
        const enabled = controller.getEnabled() === true;
        if (enabled && !placement) {
          placement = ctx.shellPlacements.registerPlacement({
            id: dashboardWidgetIds.performance,
            item: { kind: "view", presence: "closed", view: { kind: "view", id: dashboardWidgetIds.performance } },
            region: "secondary",
          });
        }
        if (!enabled && placement) {
          closePerformancePanel(ctx);
          placement.dispose();
          placement = undefined;
        }
      };
      const stopSync = controller.subscribe(syncPlacement);

      const openView = async () => {
        if (!placement) {
          await ctx.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: SETTINGS_PANEL_ID });
          return;
        }
        closeSettings(ctx);
        await ctx.navigation.openPanel({ panel: { kind: "shell-placement", id: dashboardWidgetIds.performance } });
      };

      ctx.settings.registerSection({ id: "developer-tools", title: "Developer tools", order: 25, scope: "global" });
      const disposables = [
        ctx.views.registerView({
          id: SETTINGS_VIEW_ID,
          title: "Performance",
          body: {
            kind: "react",
            render: () => <DeveloperToolsPanel controller={controller} onOpenView={() => void openView()} />,
          },
        }),
        ctx.settings.registerPanel({
          kind: "view",
          id: SETTINGS_PANEL_ID,
          title: "Performance",
          section: "developer-tools",
          scope: "global",
          order: 10,
          icon: "Gauge",
          viewId: SETTINGS_VIEW_ID,
        }),
        ctx.views.registerView({
          id: dashboardWidgetIds.performance,
          title: "Performance",
          body: {
            kind: "react",
            render: () => <PerformanceView controller={controller} projectId={getDashboardSelectedProjectId(ctx)} />,
          },
        }),
        ctx.commands.registerCommand(
          {
            id: dashboardCommandIds.openPerformance,
            label: "Open performance view",
            category: "Developer",
            icon: "Gauge",
          },
          { execute: openView },
        ),
        ctx.commands.registerCommand(
          {
            id: dashboardCommandIds.copyPerformanceSnapshot,
            label: "Copy performance snapshot",
            category: "Developer",
            icon: "Copy",
          },
          {
            execute: async () => {
              const snapshot = await controller.host.snapshot();
              if (!snapshot)
                throw new Error("Performance monitoring is off. Turn it on in Settings → Developer tools.");
              await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
              ctx.notifications.show({ level: "success", title: "Performance snapshot copied" });
            },
          },
        ),
        ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
          commandId: dashboardCommandIds.openPerformance,
          order: 46,
        }),
      ];
      return [
        ...disposables,
        {
          dispose: () => {
            stopSync();
            placement?.dispose();
            controller.dispose();
          },
        },
      ];
    },
  }) satisfies WorkbenchModuleContribution;
