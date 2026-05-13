import { useState } from "react";
import { activateProductModule, createShellCore, type ResourceRef, type ShellCore } from "../core";
import { ShellWorkbench } from "../react";
import { dashboardResources, dashboardWidgetIds } from "./dashboard-shell-example-data";
import {
  createDashboardShellModule,
  registerDashboardProjectNavigation,
  registerDashboardSettingsNavigation,
} from "./dashboard-shell-example-module";
import { DashboardLeftHeader, registerDashboardShellRenderers } from "./dashboard-shell-example-views";

const DASHBOARD_LEFT_HEADER_WIDGET_ID = "dashboard.leftHeader";

type DashboardLeftPanelMode = "project" | "settings";

const resolveLeftPanelMode = (resource: ResourceRef): DashboardLeftPanelMode =>
  resource.kind === "project-settings" ? "settings" : "project";

const resolveWidget = (resource: ResourceRef) => {
  if (resource.kind === "project-settings") return dashboardWidgetIds.settings;
  if (resource.kind === "extension-route") return dashboardWidgetIds.extensionRoute;
  return dashboardWidgetIds.tickets;
};

const registerDashboardLeftHeader = (shell: ShellCore) => {
  shell.layout.registerWidget({
    id: DASHBOARD_LEFT_HEADER_WIDGET_ID,
    title: "Project brand",
    area: "left-header",
    singleton: true,
    renderer: "react",
    rendererId: DASHBOARD_LEFT_HEADER_WIDGET_ID,
  });
  shell.renderers.registerRenderer({
    id: DASHBOARD_LEFT_HEADER_WIDGET_ID,
    render: (input) => <DashboardLeftHeader shell={input.shell} />,
  });
  shell.layout.openWidget(DASHBOARD_LEFT_HEADER_WIDGET_ID, { pinned: true, closable: false });
};

const registerDashboardModes = (shell: ShellCore) => {
  shell.modes.registerMode({
    id: "project",
    label: "Project",
    activate: (ctx) => registerDashboardProjectNavigation(ctx),
  });
  shell.modes.registerMode({
    id: "settings",
    label: "Settings",
    activate: (ctx) => registerDashboardSettingsNavigation(ctx),
  });
};

const registerPanelModeResourceOpener = (shell: ShellCore) => {
  shell.resources.registerOpener({
    id: "dashboard-shell.panel-mode-opener",
    priority: 1000,
    canOpen: (resource) => ["dashboard-view", "ticket", "extension-route", "project-settings"].includes(resource.kind),
    open: (resource, input) => {
      shell.modes.setActiveMode(resolveLeftPanelMode(resource));
      return shell.layout.openWidget(resolveWidget(resource), {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      });
    },
  });
};

const createDashboardShellExample = () => {
  const shell = createShellCore();

  shell.context.set("project.open", true);
  activateProductModule(shell, createDashboardShellModule());
  registerDashboardModes(shell);
  registerDashboardLeftHeader(shell);
  registerPanelModeResourceOpener(shell);
  registerDashboardShellRenderers(shell);
  shell.layout.openWidget(dashboardWidgetIds.status, { pinned: true, closable: false });
  shell.layout.openWidget(dashboardWidgetIds.session, { pinned: true, closable: false });
  shell.layout.openWidget(dashboardWidgetIds.tickets, { resource: dashboardResources.tickets, closable: false });
  shell.modes.setActiveMode("project");

  return { shell };
};

export const DashboardShellExample = () => {
  const [example] = useState(createDashboardShellExample);

  return <ShellWorkbench shell={example.shell} />;
};
