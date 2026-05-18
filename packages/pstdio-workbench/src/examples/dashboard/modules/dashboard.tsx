import {
  type ResourceRef,
  type WorkbenchArea,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "../../../core";
import { registerDashboardCollections } from "../collections/dashboard-collections";
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
  { kind: "workspace", label: "Workspace", icon: "GitBranch" },
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
  if (resource.kind === "workspace") return dashboardWidgetIds.workspacePage;
  if (resource.kind === "ticket") return dashboardWidgetIds.workspace;
  if (resource.id === "workspaces") return dashboardWidgetIds.workspaces;
  if (resource.id === "sessions") return dashboardWidgetIds.sessions;
  return dashboardWidgetIds.tickets;
};

const shouldShowWorkspaceList = (resource: ResourceRef) =>
  resource.kind === "workspace" || resource.uri === dashboardResources.workspaces.uri;

const syncWorkspaceListPanel = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (shouldShowWorkspaceList(resource)) {
    ctx.layout.openWidget(dashboardWidgetIds.workspaceList, { pinned: true });
    ctx.layout.setAreaVisible("main-left", true);
    ctx.panels.setOpen("main-left", true);
    return;
  }

  ctx.layout.clearArea("main-left");
};

const openResourceReplacing = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  void ctx.resources.openResource(resource, { replaceActive: true });
};

const resolveTicket = (resource: ResourceRef) =>
  dashboardTickets.find((ticket) => ticket.id === resource.id) ?? dashboardTickets[0];

const syncBreadcrumbs = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (resource.kind === "ticket") {
    const ticket = resolveTicket(resource);
    ctx.breadcrumbs.setItems([
      {
        title: "Tickets",
        icon: "KanbanSquare",
        resource: dashboardResources.tickets,
        onClick: () => openResourceReplacing(ctx, dashboardResources.tickets),
      },
      { title: `${ticket.id} ${ticket.title}`, icon: "Ticket", resource: ticket.resource },
      { title: `Attempt ${ticket.workspace.shorthand}`, icon: "GitBranch", resource: ticket.workspaceResource },
    ]);
    return;
  }

  if (resource.kind === "workspace") {
    ctx.breadcrumbs.setItems([
      {
        title: "Workspaces",
        icon: "GitBranch",
        resource: dashboardResources.workspaces,
        onClick: () => openResourceReplacing(ctx, dashboardResources.workspaces),
      },
      { title: resource.label ?? "Workspace", icon: "GitBranch", resource },
    ]);
    return;
  }

  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};

const openDashboardResource = (
  ctx: WorkbenchModuleContributionContext,
  resource: ResourceRef,
  input: { replaceActive?: boolean },
) => {
  syncWorkspaceListPanel(ctx, resource);
  syncBreadcrumbs(ctx, resource);
  return ctx.layout.openWidget(resolveWidget(resource), {
    resource,
    title: resource.label,
    replaceActive: input.replaceActive,
  });
};

const registerResourcesAndWidgets = (ctx: WorkbenchModuleContributionContext) => {
  for (const kind of dashboardResourceKinds) ctx.resources.registerKind(kind);
  ctx.resources.registerOpener({
    id: "dashboard-workbench.opener",
    priority: 100,
    canOpen: (resource) =>
      ["dashboard-view", "ticket", "workspace", "extension-route", "project-settings"].includes(resource.kind),
    open: (resource, input) => openDashboardResource(ctx, resource, input),
  });

  registerReactWidget(ctx, dashboardWidgetIds.header, "Dashboard header", "top", 100);
  // dashboardWidgetIds.tickets is registered via ctx.renderers.registerDataRenderer
  // in dashboard-collections.ts.
  registerReactWidget(ctx, dashboardWidgetIds.workspaces, "Workspaces", "main", 85);
  registerReactWidget(ctx, dashboardWidgetIds.workspace, "Workspace", "main", 80);
  registerReactWidget(ctx, dashboardWidgetIds.workspacePage, "Workspace", "main", 78);
  registerReactWidget(ctx, dashboardWidgetIds.workspaceList, "Workspace list", "main-left", 75);
  registerReactWidget(ctx, dashboardWidgetIds.sessions, "Sessions", "main", 74);
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
    list: () => [
      { resource: dashboardResources.tickets, group: "Dashboard" },
      { resource: dashboardResources.workspaces, group: "Dashboard" },
      { resource: dashboardResources.sessions, group: "Dashboard" },
    ],
  });

  ctx.resources.registerProvider({
    id: "dashboard-workbench.workspaces",
    kind: "workspace",
    list: () => dashboardTickets.map(({ workspaceResource }) => ({ resource: workspaceResource, group: "Workspaces" })),
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
    { execute: () => ctx.resources.openResource(dashboardResources.tickets, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openWorkspaces", label: "Open workspaces", category: "Dashboard", icon: "GitBranch" },
    { execute: () => ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openSessions", label: "Open sessions", category: "Dashboard", icon: "MessagesSquare" },
    { execute: () => ctx.resources.openResource(dashboardResources.sessions, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openSettings", label: "Open project settings", category: "Dashboard", icon: "Settings" },
    { execute: () => ctx.resources.openResource(dashboardResources.settings, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openCurrentWorkspace", label: "Open current workspace", category: "Dashboard", icon: "GitBranch" },
    { execute: () => ctx.resources.openResource(dashboardTickets[0].workspaceResource, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openRepoHealth", label: "Open repo health", category: "Repo Health", icon: "GitBranch" },
    { execute: () => ctx.resources.openResource(dashboardResources.repoHealth, { replaceActive: true }) },
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
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openTickets", order: 10 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openWorkspaces", order: 20 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "dashboard.openCurrentWorkspace",
    order: 30,
  });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openSessions", order: 40 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openSettings", order: 50 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.sayHello", order: 60 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.runHealthScan", order: 70 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openRepoHealth", order: 80 });
  ctx.layout.registerMenuItem(dashboardHelpMenuPath, { commandId: "dashboard.openDocs", order: 10 });
  ctx.layout.registerMenuItem(dashboardHelpMenuPath, { commandId: "dashboard.openShortcuts", order: 20 });
  ctx.layout.registerMenuItem(dashboardHelpMenuPath, { commandId: "dashboard.contactSupport", order: 30 });
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
    canOpen: (resource) =>
      ["dashboard-view", "ticket", "workspace", "extension-route", "project-settings"].includes(resource.kind),
    open: (resource, input) => {
      ctx.modes.setActiveMode(resolveLeftPanelMode(resource));
      return openDashboardResource(ctx, resource, input);
    },
  });
};

export const registerDashboardWorkbenchContributions = (ctx: WorkbenchModuleContributionContext) => {
  ctx.context.set("project.open", true);

  registerResourcesAndWidgets(ctx);
  registerResourceProviders(ctx);
  registerCommands(ctx);
  registerMenus(ctx);
  const collectionDisposables = registerDashboardCollections(ctx);
  registerLeftHeader(ctx);
  registerPanelModeResourceOpener(ctx);
  registerDashboardWorkbenchRenderers(ctx);

  ctx.layout.openWidget(dashboardWidgetIds.header, { pinned: true });
  ctx.layout.openWidget(dashboardWidgetIds.status, { pinned: true });
  ctx.layout.openWidget(dashboardWidgetIds.session, { pinned: true });
  openDashboardResource(ctx, dashboardResources.tickets, {});

  return collectionDisposables;
};
