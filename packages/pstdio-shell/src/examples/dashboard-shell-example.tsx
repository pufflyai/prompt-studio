import { useState } from "react";
import { activateProductModule, createShellCore, type ResourceRef, type ShellCore } from "../core";
import { ShellWorkbench } from "../react";
import {
  dashboardCommandPaletteMenuPath,
  dashboardFooterTreeViewId,
  dashboardNavigationTreeViewId,
  dashboardResources,
  dashboardSettingsNavigationTreeViewId,
  dashboardWidgetIds,
} from "./dashboard-shell-example-data";
import { createDashboardShellModule } from "./dashboard-shell-example-module";
import { DashboardLeftHeader, registerDashboardShellRenderers } from "./dashboard-shell-example-views";

type DashboardLeftPanelMode = "project" | "settings";

const dashboardLeftPanelSetups = {
  project: {
    treeViewId: dashboardNavigationTreeViewId,
    footerTreeViewId: dashboardFooterTreeViewId,
  },
  settings: {
    treeViewId: dashboardSettingsNavigationTreeViewId,
  },
} satisfies Record<DashboardLeftPanelMode, { treeViewId: string; footerTreeViewId?: string }>;

const resolveLeftPanelMode = (resource: ResourceRef): DashboardLeftPanelMode =>
  resource.kind === "project-settings" ? "settings" : "project";

const resolveWidget = (resource: ResourceRef) => {
  if (resource.kind === "project-settings") return dashboardWidgetIds.settings;
  if (resource.kind === "extension-route") return dashboardWidgetIds.extensionRoute;
  return dashboardWidgetIds.tickets;
};

const registerPanelModeResourceOpener = (
  shell: ShellCore,
  setLeftPanelMode: (mode: DashboardLeftPanelMode) => void,
) => {
  shell.resources.registerOpener({
    id: "dashboard-shell.panel-mode-opener",
    priority: 1000,
    canOpen: (resource) => ["dashboard-view", "ticket", "extension-route", "project-settings"].includes(resource.kind),
    open: (resource) => {
      setLeftPanelMode(resolveLeftPanelMode(resource));
      return shell.layout.openWidget(resolveWidget(resource), { resource, title: resource.label });
    },
  });
};

const createDashboardShellExample = (setLeftPanelMode: (mode: DashboardLeftPanelMode) => void) => {
  const shell = createShellCore();

  shell.context.set("project.open", true);
  activateProductModule(shell, createDashboardShellModule());
  registerPanelModeResourceOpener(shell, setLeftPanelMode);
  registerDashboardShellRenderers(shell);
  shell.layout.openWidget(dashboardWidgetIds.status, { pinned: true, closable: false });
  shell.layout.openWidget(dashboardWidgetIds.session, { pinned: true, closable: false });
  shell.layout.openWidget(dashboardWidgetIds.tickets, { resource: dashboardResources.tickets, closable: false });

  return { shell };
};

export const DashboardShellExample = () => {
  const [leftPanelMode, setLeftPanelMode] = useState<DashboardLeftPanelMode>("project");
  const [example] = useState(() => createDashboardShellExample(setLeftPanelMode));
  const leftPanelSetup: { treeViewId: string; footerTreeViewId?: string } = dashboardLeftPanelSetups[leftPanelMode];

  return (
    <ShellWorkbench
      shell={example.shell}
      commandPaletteMenuPath={dashboardCommandPaletteMenuPath}
      leftTreeViewId={leftPanelSetup.treeViewId}
      leftFooterTreeViewId={leftPanelSetup.footerTreeViewId}
      leftHeader={<DashboardLeftHeader shell={example.shell} />}
      showCommandPaletteTreeNode={false}
    />
  );
};
