import {
  type ResourceRef,
  type ShellArea,
  type ShellCore,
  type ShellModuleContribution,
  type ShellModuleContributionContext,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "../../../core";
import { DashboardLeftHeader, registerDashboardShellRenderers } from "../components/views";
import { dashboardHelpMenuPath, dashboardResources, dashboardWidgetIds } from "../mock-data/data";

const DASHBOARD_LEFT_HEADER_WIDGET_ID = "dashboard.leftHeader";

type DashboardLeftPanelMode = "project" | "settings";

const dashboardResourceKinds = [
  { kind: "project", label: "Project", icon: "FolderGit2" },
  { kind: "dashboard-view", label: "Dashboard view", icon: "KanbanSquare" },
  { kind: "ticket", label: "Ticket", icon: "Ticket" },
  { kind: "extension-route", label: "Extension route", icon: "PanelLeft" },
  { kind: "project-settings", label: "Project settings", icon: "Settings" },
] as const;

const registerReactWidget = (
  ctx: ShellModuleContributionContext,
  id: string,
  title: string,
  area: ShellArea,
  priority: number,
) =>
  ctx.layout.registerWidget(
    { id, title, area, singleton: true, renderer: "react", rendererId: id, priority },
    { priority },
  );

const resolveLeftPanelMode = (resource: ResourceRef): DashboardLeftPanelMode =>
  resource.kind === "project-settings" ? "settings" : "project";

const resolveWidget = (resource: ResourceRef) => {
  if (resource.kind === "project-settings") return dashboardWidgetIds.settings;
  if (resource.kind === "extension-route") return dashboardWidgetIds.extensionRoute;
  return dashboardWidgetIds.tickets;
};

const registerResourcesAndWidgets = (ctx: ShellModuleContributionContext) => {
  for (const kind of dashboardResourceKinds) ctx.resources.registerKind(kind);
  ctx.resources.registerOpener({
    id: "dashboard-shell.opener",
    priority: 100,
    canOpen: (resource) => ["dashboard-view", "ticket", "extension-route", "project-settings"].includes(resource.kind),
    open: (resource, input) =>
      ctx.layout.openWidget(resolveWidget(resource), {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      }),
  });

  registerReactWidget(ctx, dashboardWidgetIds.tickets, "Tickets", "main", 90);
  registerReactWidget(ctx, dashboardWidgetIds.extensionRoute, "Extension route", "main", 70);
  registerReactWidget(ctx, dashboardWidgetIds.settings, "Project settings", "main", 60);
  registerReactWidget(ctx, dashboardWidgetIds.status, "Dashboard status", "status", 50);
  registerReactWidget(ctx, dashboardWidgetIds.session, "Session", "floating", 40);
};

const registerCommands = (ctx: ShellModuleContributionContext) => {
  ctx.commands.registerCommand(
    { id: "dashboard.openTickets", label: "Open tickets", category: "Dashboard", icon: "KanbanSquare" },
    { execute: () => ctx.resources.openResource(dashboardResources.tickets) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openSettings", label: "Open project settings", category: "Dashboard", icon: "Settings" },
    { execute: () => ctx.resources.openResource(dashboardResources.settings) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openRepoHealth", label: "Open repo health", category: "Repo Health", icon: "GitBranch" },
    { execute: () => ctx.resources.openResource(dashboardResources.repoHealth) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.sayHello", label: "Say hello", category: "Extension Lab", icon: "Sparkles" },
    { execute: () => ctx.notifications.show({ level: "success", title: "Hello from Extension Lab" }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.runHealthScan", label: "Run repo health scan", category: "Repo Health", icon: "Workflow" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Repo health scan queued" }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.download", label: "Download", category: "Dashboard", icon: "Download" },
    { execute: () => ctx.notifications.show({ level: "success", title: "Dashboard export downloaded" }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openDocs", label: "Open docs", category: "Help", icon: "BookOpen" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Opening dashboard docs" }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openShortcuts", label: "Keyboard shortcuts", category: "Help", icon: "Keyboard" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Keyboard shortcuts opened" }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.contactSupport", label: "Contact support", category: "Help", icon: "MessageSquare" },
    { execute: () => ctx.notifications.show({ level: "success", title: "Support request started" }) },
  );
};

const registerMenus = (ctx: ShellModuleContributionContext) => {
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openTickets", order: 10 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openSettings", order: 20 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.sayHello", order: 30 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.runHealthScan", order: 40 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openRepoHealth", order: 50 });
  ctx.menus.registerMenuAction(workbenchTopHeaderTrailingMenuPath, { commandId: "dashboard.download", order: 10 });
  ctx.menus.registerMenuAction(dashboardHelpMenuPath, { commandId: "dashboard.openDocs", order: 10 });
  ctx.menus.registerMenuAction(dashboardHelpMenuPath, { commandId: "dashboard.openShortcuts", order: 20 });
  ctx.menus.registerMenuAction(dashboardHelpMenuPath, { commandId: "dashboard.contactSupport", order: 30 });
};

const createDashboardShellModule = () =>
  ({
    id: "dashboard-shell.example",
    activate(ctx) {
      registerResourcesAndWidgets(ctx);
      registerCommands(ctx);
      registerMenus(ctx);
    },
  }) satisfies ShellModuleContribution;

const registerLeftHeader = (shell: ShellCore) => {
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

export const activateDashboard = (shell: ShellCore) => {
  shell.context.set("project.open", true);

  shell.registerModule(createDashboardShellModule());
  registerLeftHeader(shell);
  registerPanelModeResourceOpener(shell);
  registerDashboardShellRenderers(shell);

  shell.layout.openWidget(dashboardWidgetIds.status, { pinned: true, closable: false });
  shell.layout.openWidget(dashboardWidgetIds.session, { pinned: true, closable: false });
  shell.layout.openWidget(dashboardWidgetIds.tickets, { resource: dashboardResources.tickets, closable: false });
};
