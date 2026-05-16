import {
  type ResourceRef,
  type WorkbenchArea,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "../../../core";
import { DashboardLeftHeader, registerDashboardWorkbenchRenderers } from "../components/views";
import {
  dashboardHelpMenuPath,
  dashboardResources,
  dashboardSettingsResources,
  dashboardTickets,
  dashboardWidgetIds,
} from "../mock-data/data";

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
  ctx: WorkbenchModuleContributionContext,
  id: string,
  title: string,
  area: WorkbenchArea,
  priority: number,
) => ctx.layout.registerWidget({ id, title, area, singleton: true, rendererId: id, priority }, { priority });

const resolveLeftPanelMode = (resource: ResourceRef): DashboardLeftPanelMode =>
  resource.kind === "project-settings" ? "settings" : "project";

const resolveWidget = (resource: ResourceRef) => {
  if (resource.kind === "project-settings") return dashboardWidgetIds.settings;
  if (resource.kind === "extension-route") return dashboardWidgetIds.extensionRoute;
  return dashboardWidgetIds.tickets;
};

const registerResourcesAndWidgets = (ctx: WorkbenchModuleContributionContext) => {
  for (const kind of dashboardResourceKinds) ctx.resources.registerKind(kind);
  ctx.resources.registerOpener({
    id: "dashboard-workbench.opener",
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

const registerResourceProviders = (ctx: WorkbenchModuleContributionContext) => {
  ctx.resources.registerProvider({
    id: "dashboard-workbench.tickets",
    kind: "ticket",
    list: () => dashboardTickets.map(({ resource }) => ({ resource, group: "Tickets" })),
  });

  ctx.resources.registerProvider({
    id: "dashboard-workbench.dashboard-views",
    kind: "dashboard-view",
    list: () => [{ resource: dashboardResources.tickets, group: "Dashboard" }],
  });

  ctx.resources.registerProvider({
    id: "dashboard-workbench.extension-routes",
    kind: "extension-route",
    list: () => [
      { resource: dashboardResources.lab, group: "Extensions" },
      { resource: dashboardResources.repoHealth, group: "Extensions" },
      { resource: dashboardResources.changelog, group: "Extensions" },
    ],
  });

  ctx.resources.registerProvider({
    id: "dashboard-workbench.project-settings",
    kind: "project-settings",
    list: () => [
      { resource: dashboardResources.settings, group: "Settings" },
      { resource: dashboardSettingsResources.agents, group: "Settings" },
      { resource: dashboardSettingsResources.repositories, group: "Settings" },
      { resource: dashboardSettingsResources.labSettings, group: "Settings" },
      { resource: dashboardSettingsResources.auditLog, group: "Settings" },
      { resource: dashboardSettingsResources.repoHealth, group: "Settings" },
    ],
  });
};

const registerCommands = (ctx: WorkbenchModuleContributionContext) => {
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
    { id: "dashboard.openCommandPalette", label: "Search", category: "Workbench", icon: "Search" },
    { execute: () => ctx.commandPalette.open() },
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

const registerMenus = (ctx: WorkbenchModuleContributionContext) => {
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openTickets", order: 10 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openSettings", order: 20 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.sayHello", order: 30 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.runHealthScan", order: 40 });
  ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openRepoHealth", order: 50 });
  ctx.menus.registerMenuAction(workbenchTopHeaderTrailingMenuPath, {
    commandId: "dashboard.openCommandPalette",
    order: 5,
  });
  ctx.menus.registerMenuAction(workbenchTopHeaderTrailingMenuPath, { commandId: "dashboard.download", order: 10 });
  ctx.menus.registerMenuAction(dashboardHelpMenuPath, { commandId: "dashboard.openDocs", order: 10 });
  ctx.menus.registerMenuAction(dashboardHelpMenuPath, { commandId: "dashboard.openShortcuts", order: 20 });
  ctx.menus.registerMenuAction(dashboardHelpMenuPath, { commandId: "dashboard.contactSupport", order: 30 });
};

const registerLeftHeader = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: DASHBOARD_LEFT_HEADER_WIDGET_ID,
    title: "Project brand",
    area: "left-header",
    singleton: true,
    rendererId: DASHBOARD_LEFT_HEADER_WIDGET_ID,
  });
  ctx.renderers.registerRenderer({
    id: DASHBOARD_LEFT_HEADER_WIDGET_ID,
    render: (input) => <DashboardLeftHeader workbench={input.workbench} />,
  });
  ctx.layout.openWidget(DASHBOARD_LEFT_HEADER_WIDGET_ID, { pinned: true });
};

const registerPanelModeResourceOpener = (ctx: WorkbenchModuleContributionContext) => {
  ctx.resources.registerOpener({
    id: "dashboard-workbench.panel-mode-opener",
    priority: 1000,
    canOpen: (resource) => ["dashboard-view", "ticket", "extension-route", "project-settings"].includes(resource.kind),
    open: (resource, input) => {
      ctx.modes.setActiveMode(resolveLeftPanelMode(resource));
      return ctx.layout.openWidget(resolveWidget(resource), {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      });
    },
  });
};

export const registerDashboardWorkbenchContributions = (ctx: WorkbenchModuleContributionContext) => {
  ctx.context.set("project.open", true);

  registerResourcesAndWidgets(ctx);
  registerResourceProviders(ctx);
  registerCommands(ctx);
  registerMenus(ctx);
  registerLeftHeader(ctx);
  registerPanelModeResourceOpener(ctx);
  registerDashboardWorkbenchRenderers(ctx);

  ctx.layout.openWidget(dashboardWidgetIds.status, { pinned: true });
  ctx.layout.openWidget(dashboardWidgetIds.session, { pinned: true });
  ctx.layout.openWidget(dashboardWidgetIds.tickets, { resource: dashboardResources.tickets });
};
