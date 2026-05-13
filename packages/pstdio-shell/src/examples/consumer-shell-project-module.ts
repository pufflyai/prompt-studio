import type { ProductModuleContribution, ProductModuleContributionContext, ResourceRef, ShellArea } from "../core";
import {
  commandPaletteMenuPath,
  helpMenuPath,
  resourceContextMenuPath,
  shellExampleResources,
  shellWidgetIds,
} from "./consumer-shell-example-data";

export const projectScope = { scope: "project" as const, scopeId: "prompt-studio" };

const registerReactWidget = (
  ctx: ProductModuleContributionContext,
  id: string,
  title: string,
  area: ShellArea,
  priority: number,
) =>
  ctx.layout.registerWidget(
    {
      id,
      title,
      area,
      singleton: true,
      renderer: "react",
      rendererId: id,
      priority,
    },
    { priority },
  );

const resolveProjectWidget = (resource: ResourceRef) => {
  if (resource.id === shellExampleResources.registryInventory.id) return shellWidgetIds.registryInventory;
  if (resource.kind === "ticket" || resource.kind === "dashboard-view") return shellWidgetIds.tickets;
  if (resource.kind === "workspace") return shellWidgetIds.workspace;
  if (resource.kind === "settings") return shellWidgetIds.settings;
  return shellWidgetIds.overview;
};

const registerProjectCommands = (ctx: ProductModuleContributionContext) => {
  ctx.commands.registerCommand(
    { id: "project.openOverview", label: "Open overview", category: "Project", icon: "KanbanSquare" },
    { execute: () => ctx.resources.openResource(shellExampleResources.project) },
  );
  ctx.commands.registerCommand(
    { id: "project.openTickets", label: "Open tickets", category: "Project", icon: "KanbanSquare" },
    { execute: () => ctx.resources.openResource(shellExampleResources.tickets) },
  );
  ctx.commands.registerCommand(
    { id: "project.openSettings", label: "Open settings", category: "Project", icon: "Settings" },
    { execute: () => ctx.resources.openResource(shellExampleResources.settings) },
  );
  ctx.commands.registerCommand(
    { id: "project.openRegistryInventory", label: "Open registry inventory", category: "Shell", icon: "Boxes" },
    { execute: () => ctx.resources.openResource(shellExampleResources.registryInventory) },
  );
  ctx.commands.registerCommand(
    { id: "project.showNotification", label: "Show shell notification", category: "Shell", icon: "Bell" },
    {
      execute: () =>
        ctx.notifications.show({
          id: "project.registry-sync",
          level: "warning",
          title: "Registry sync needs attention",
          message: "Two runtime extension resources were indexed with warnings.",
          resource: shellExampleResources.registryInventory,
          actions: [{ commandId: "project.openRegistryInventory", title: "Open inventory" }],
        }),
    },
  );
  ctx.commands.registerCommand(
    { id: "project.runChecks", label: "Run checks", category: "Project", icon: "ListChecks" },
    {
      execute: () => {
        ctx.diagnostics.report({
          id: "project.run-checks",
          source: "project.checks",
          severity: "info",
          message: "Registry contribution smoke checks completed.",
          resource: shellExampleResources.project,
        });
        ctx.activity.emit({
          id: "activity.run-checks",
          kind: "project.event",
          title: "Checks completed",
          message: "Commands, menus, layout, resources, and trees are wired.",
          severity: "success",
          createdAt: "2026-05-13T10:05:00.000Z",
          resource: shellExampleResources.project,
        });
        ctx.notifications.show({
          level: "success",
          title: "Shell checks completed",
          message: "Commands, menus, layout, resources, trees, diagnostics, activity, and notifications are wired.",
          resource: shellExampleResources.project,
          actions: [{ commandId: "project.openRegistryInventory", title: "Open inventory" }],
        });
        return ctx.layout.openWidget(shellWidgetIds.checks);
      },
    },
  );
  ctx.commands.registerCommand(
    { id: "project.clearDiagnostic", label: "Clear diagnostic", category: "Diagnostics", icon: "CheckCircle2" },
    {
      execute: (args) => {
        const { diagnosticId } = args as { diagnosticId: string };
        ctx.diagnostics.clear(diagnosticId);
        ctx.activity.emit({
          id: `activity.clear-${diagnosticId}`,
          kind: "project.event",
          title: "Diagnostic cleared",
          message: diagnosticId,
          severity: "success",
          createdAt: "2026-05-13T10:06:00.000Z",
          resource: shellExampleResources.project,
        });
      },
    },
  );
  ctx.commands.registerCommand(
    { id: "project.togglePreview", label: "Toggle preview context", category: "Shell", icon: "PanelRight" },
    {
      execute: () => {
        const nextValue = !ctx.context.get("project.previewOpen");
        ctx.context.set("project.previewOpen", nextValue);
        ctx.activity.emit({
          id: `activity.preview-${String(nextValue)}`,
          kind: "project.event",
          title: nextValue ? "Preview context enabled" : "Preview context disabled",
          createdAt: "2026-05-13T10:07:00.000Z",
          resource: shellExampleResources.project,
        });
      },
      isToggled: () => Boolean(ctx.context.get("project.previewOpen")),
    },
  );
  ctx.commands.registerCommand(
    { id: "project.openDocs", label: "Open docs", category: "Help", icon: "BookOpen" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Opening shell docs" }) },
  );
  ctx.commands.registerCommand(
    { id: "project.openShortcuts", label: "Keyboard shortcuts", category: "Help", icon: "Keyboard" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Keyboard shortcuts opened" }) },
  );
  ctx.commands.registerCommand(
    { id: "project.contactSupport", label: "Contact support", category: "Help", icon: "MessageSquare" },
    { execute: () => ctx.notifications.show({ level: "success", title: "Support request started" }) },
  );
};

const registerProjectRegistries = (ctx: ProductModuleContributionContext) => {
  ctx.resources.registerKind({ kind: "project", label: "Project", icon: "FolderGit2" });
  ctx.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view", icon: "KanbanSquare" });
  ctx.resources.registerKind({ kind: "ticket", label: "Ticket", icon: "Ticket" });
  ctx.resources.registerKind({ kind: "workspace", label: "Workspace", icon: "GitBranch" });
  ctx.resources.registerKind({ kind: "settings", label: "Settings", icon: "Settings" });
  ctx.resources.registerOpener({
    id: "project.resourceOpener",
    priority: 100,
    canOpen: (resource) => ["project", "dashboard-view", "ticket", "workspace", "settings"].includes(resource.kind),
    open: (resource) => ctx.layout.openWidget(resolveProjectWidget(resource), { resource, title: resource.label }),
  });

  registerReactWidget(ctx, shellWidgetIds.overview, "Project overview", "main", 100);
  registerReactWidget(ctx, shellWidgetIds.tickets, "Tickets", "main", 90);
  registerReactWidget(ctx, shellWidgetIds.workspace, "Workspace PS-266", "main", 80);
  registerReactWidget(ctx, shellWidgetIds.settings, "Project settings", "main", 70);
  registerReactWidget(ctx, shellWidgetIds.registryInventory, "Registry inventory", "main", 60);
  registerReactWidget(ctx, shellWidgetIds.checks, "Checks", "main-bottom", 50);
  registerReactWidget(ctx, shellWidgetIds.session, "Session A", "floating", 40);

  ctx.activity.registerKind({ kind: "project.event", title: "Project events", icon: "Activity" });
  ctx.activity.registerKind({ kind: "session.event", title: "Session events", icon: "MessageCircle" });
  ctx.diagnostics.registerSource({ source: "project.checks", title: "Project checks", icon: "ListChecks" });
};

const registerProjectNavigation = (ctx: ProductModuleContributionContext) => {
  ctx.trees.registerTreeView({
    id: "project.navigation",
    title: "Prompt Studio",
    area: "left",
    getRoots: () => [],
    getSections: () => [
      {
        id: "primary",
        nodes: [
          {
            id: shellExampleResources.project.uri,
            label: "Overview",
            icon: "KanbanSquare",
            resource: shellExampleResources.project,
          },
          {
            id: shellExampleResources.tickets.uri,
            label: "Tickets",
            icon: "KanbanSquare",
            resource: shellExampleResources.tickets,
          },
          { id: "workspace-group", label: "Workspaces", icon: "GitBranch", collapsible: true },
        ],
      },
      {
        id: "registries",
        label: "Shell registries",
        nodes: [
          {
            id: shellExampleResources.registryInventory.uri,
            label: "Inventory",
            icon: "Boxes",
            resource: shellExampleResources.registryInventory,
          },
          {
            id: shellExampleResources.extensionReview.uri,
            label: "Extension review",
            icon: "Puzzle",
            resource: shellExampleResources.extensionReview,
          },
        ],
      },
    ],
    getChildren: (node) =>
      node.id === "workspace-group"
        ? [
            {
              id: shellExampleResources.workspace.uri,
              label: "PS-266 shell examples",
              icon: "GitBranch",
              resource: shellExampleResources.workspace,
            },
            {
              id: shellExampleResources.workspace267.uri,
              label: "PS-267 extension webviews",
              icon: "GitBranch",
              resource: shellExampleResources.workspace267,
            },
          ]
        : [],
  });
  ctx.trees.registerTreeView({
    id: "project.navigation.footer",
    title: "Project footer",
    area: "left",
    role: "footer",
    getRoots: () => [],
    getSections: () => [
      {
        id: "footer",
        nodes: [
          {
            id: shellExampleResources.settings.uri,
            label: "Settings",
            icon: "Settings",
            resource: shellExampleResources.settings,
          },
          { id: "help", label: "Help", icon: "CircleHelp", menuPath: helpMenuPath },
        ],
      },
    ],
    getChildren: () => [],
  });
};

const registerProjectPreferences = (ctx: ProductModuleContributionContext) => {
  ctx.preferences.registerSchema({
    properties: {
      "project.autoOpenSession": { type: "boolean", default: true, scope: "project" },
      "project.defaultWorkspace": { type: "string", default: "workspace-ps-266", scope: "project" },
      "project.ticketGrouping": {
        type: "string",
        enum: ["status", "workspace", "assignee"],
        default: "status",
        scope: "user",
      },
    },
  });
  ctx.preferences.setValue("project.ticketGrouping", "status", { scope: "user" });
  ctx.preferences.setValue("project.autoOpenSession", true, projectScope);
};

const registerProjectMenusAndKeybindings = (ctx: ProductModuleContributionContext) => {
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.openOverview", order: 10 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.openTickets", order: 20 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.openRegistryInventory", order: 30 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.showNotification", order: 40 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.runChecks", order: 50 });
  ctx.menus.registerMenuAction(resourceContextMenuPath, { commandId: "project.openSettings", order: 10 });
  ctx.menus.registerMenuAction(helpMenuPath, { commandId: "project.openDocs", order: 10 });
  ctx.menus.registerMenuAction(helpMenuPath, { commandId: "project.openShortcuts", order: 20 });
  ctx.menus.registerMenuAction(helpMenuPath, { commandId: "project.contactSupport", order: 30 });
  ctx.keybindings.registerKeybinding({ commandId: "project.openOverview", keybinding: "Meta+1", when: "project.open" });
  ctx.keybindings.registerKeybinding({ commandId: "project.openTickets", keybinding: "Meta+2", when: "project.open" });
  ctx.keybindings.registerKeybinding({
    commandId: "project.runChecks",
    keybinding: "Meta+Shift+B",
    when: "project.open && project.previewOpen",
  });
};

export const createProjectModule = () =>
  ({
    id: "prompt-studio.project",
    activate(ctx) {
      registerProjectRegistries(ctx);
      registerProjectCommands(ctx);
      registerProjectMenusAndKeybindings(ctx);
      registerProjectPreferences(ctx);
      registerProjectNavigation(ctx);
      ctx.lifecycle.registerHook("activate", () => {
        ctx.activity.emit({
          id: "activity.shell-activated",
          kind: "project.event",
          title: "Shell activated",
          message: "Product module contributions are registered.",
          severity: "success",
          createdAt: "2026-05-13T10:00:00.000Z",
          resource: shellExampleResources.project,
        });
      });
      ctx.lifecycle.registerHook("reload", () => {
        ctx.activity.emit({
          id: "activity.shell-reloaded",
          kind: "project.event",
          title: "Shell reloaded",
          createdAt: "2026-05-13T10:04:00.000Z",
          resource: shellExampleResources.project,
        });
      });
    },
  }) satisfies ProductModuleContribution;
