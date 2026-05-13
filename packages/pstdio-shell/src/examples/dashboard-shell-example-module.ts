import {
  type ProductModuleContribution,
  type ProductModuleContributionContext,
  type ResourceRef,
  type ShellArea,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "../core";
import {
  dashboardFooterTreeViewId,
  dashboardHelpMenuPath,
  dashboardNavigationTreeViewId,
  dashboardResources,
  dashboardSettingsNavigationTreeViewId,
  dashboardSettingsResources,
  dashboardWidgetIds,
} from "./dashboard-shell-example-data";

const dashboardResourceKinds = [
  { kind: "project", label: "Project", icon: "FolderGit2" },
  { kind: "dashboard-view", label: "Dashboard view", icon: "KanbanSquare" },
  { kind: "ticket", label: "Ticket", icon: "Ticket" },
  { kind: "extension-route", label: "Extension route", icon: "PanelLeft" },
  { kind: "project-settings", label: "Project settings", icon: "Settings" },
] as const;

const registerReactWidget = (
  ctx: ProductModuleContributionContext,
  id: string,
  title: string,
  area: ShellArea,
  priority: number,
) =>
  ctx.layout.registerWidget(
    { id, title, area, singleton: true, renderer: "react", rendererId: id, priority },
    { priority },
  );

const resolveWidget = (resource: ResourceRef) => {
  if (resource.kind === "project-settings") return dashboardWidgetIds.settings;
  if (resource.kind === "extension-route") return dashboardWidgetIds.extensionRoute;
  return dashboardWidgetIds.tickets;
};

const registerResourcesAndWidgets = (ctx: ProductModuleContributionContext) => {
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

const registerCommands = (ctx: ProductModuleContributionContext) => {
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

const registerMenus = (ctx: ProductModuleContributionContext) => {
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

export const registerDashboardProjectNavigation = (ctx: ProductModuleContributionContext) => [
  ctx.trees.registerTreeView({
    id: dashboardNavigationTreeViewId,
    title: "Acme",
    area: "left",
    getRoots: () => [],
    getSections: () => [
      {
        id: "primary",
        nodes: [
          {
            id: dashboardResources.tickets.uri,
            label: "Tickets",
            icon: "KanbanSquare",
            resource: dashboardResources.tickets,
          },
        ],
      },
      {
        id: "extensions",
        label: "project.sidebarNav",
        nodes: [
          { id: dashboardResources.lab.uri, label: "Lab", icon: "FlaskConical", resource: dashboardResources.lab },
          {
            id: dashboardResources.repoHealth.uri,
            label: "Repo health",
            icon: "GitBranch",
            resource: dashboardResources.repoHealth,
          },
          {
            id: dashboardResources.changelog.uri,
            label: "Changelog",
            icon: "Workflow",
            resource: dashboardResources.changelog,
          },
        ],
      },
    ],
    getChildren: () => [],
  }),
  ctx.trees.registerTreeView({
    id: dashboardFooterTreeViewId,
    title: "Acme footer",
    area: "left",
    role: "footer",
    getRoots: () => [],
    getSections: () => [
      {
        id: "footer",
        nodes: [
          {
            id: "help",
            label: "Help",
            icon: "CircleHelp",
            menuPath: dashboardHelpMenuPath,
            menuPlacement: "top-start",
          },
          {
            id: dashboardResources.settings.uri,
            label: "Project settings",
            icon: "Settings",
            resource: dashboardResources.settings,
          },
        ],
      },
    ],
    getChildren: () => [],
  }),
];

export const registerDashboardSettingsNavigation = (ctx: ProductModuleContributionContext) => [
  ctx.trees.registerTreeView({
    id: dashboardSettingsNavigationTreeViewId,
    title: "Project settings",
    area: "left",
    getRoots: () => [],
    getSections: () => [
      {
        id: "settings-back",
        nodes: [
          {
            id: `${dashboardResources.tickets.uri}/back`,
            label: "Back to dashboard",
            icon: "KanbanSquare",
            resource: dashboardResources.tickets,
          },
        ],
      },
      {
        id: "settings",
        label: "Project settings",
        nodes: [
          {
            id: dashboardResources.settings.uri,
            label: "Overview",
            icon: "Settings",
            resource: dashboardResources.settings,
          },
          {
            id: dashboardSettingsResources.agents.uri,
            label: "Agents",
            icon: "Bot",
            resource: dashboardSettingsResources.agents,
          },
          {
            id: dashboardSettingsResources.repositories.uri,
            label: "Repositories",
            icon: "GitBranch",
            resource: dashboardSettingsResources.repositories,
          },
        ],
      },
      {
        id: "extension-settings",
        label: "Extensions",
        nodes: [
          {
            id: dashboardSettingsResources.labSettings.uri,
            label: "Lab settings",
            icon: "FlaskConical",
            resource: dashboardSettingsResources.labSettings,
          },
          {
            id: dashboardSettingsResources.auditLog.uri,
            label: "Audit log",
            icon: "ClipboardList",
            resource: dashboardSettingsResources.auditLog,
          },
          {
            id: dashboardSettingsResources.repoHealth.uri,
            label: "Repo health",
            icon: "GitBranch",
            resource: dashboardSettingsResources.repoHealth,
          },
        ],
      },
    ],
    getChildren: () => [],
  }),
];

export const createDashboardShellModule = () =>
  ({
    id: "dashboard-shell.example",
    activate(ctx) {
      registerResourcesAndWidgets(ctx);
      registerCommands(ctx);
      registerMenus(ctx);
    },
  }) satisfies ProductModuleContribution;
