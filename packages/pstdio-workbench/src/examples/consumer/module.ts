import type {
  ResourceRef,
  WorkbenchArea,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "../../core";
import { registerConsumerWorkbenchRenderers } from "./components/views";
import {
  commandPaletteMenuPath,
  helpMenuPath,
  resourceContextMenuPath,
  workbenchExampleResources,
  workbenchExampleTickets,
  workbenchWidgetIds,
} from "./mock-data/data";

export const projectScope = { scope: "project" as const, scopeId: "prompt-studio" };

const registerReactWidget = (
  ctx: WorkbenchModuleContributionContext,
  id: string,
  title: string,
  area: WorkbenchArea,
  priority: number,
) =>
  ctx.layout.registerWidget(
    {
      id,
      title,
      area,
      singleton: true,
      rendererId: id,
      priority,
    },
    { priority },
  );

const resolveProjectWidget = (resource: ResourceRef) => {
  if (resource.id === workbenchExampleResources.registryInventory.id) return workbenchWidgetIds.registryInventory;
  if (resource.kind === "ticket" || resource.kind === "dashboard-view") return workbenchWidgetIds.tickets;
  if (resource.kind === "workspace") return workbenchWidgetIds.workspace;
  if (resource.kind === "settings") return workbenchWidgetIds.settings;
  return workbenchWidgetIds.overview;
};

const registerProjectCommands = (ctx: WorkbenchModuleContributionContext) => {
  ctx.commands.registerCommand(
    { id: "project.openOverview", label: "Open overview", category: "Project", icon: "KanbanSquare" },
    { execute: () => ctx.resources.openResource(workbenchExampleResources.project) },
  );
  ctx.commands.registerCommand(
    { id: "project.openTickets", label: "Open tickets", category: "Project", icon: "KanbanSquare" },
    { execute: () => ctx.resources.openResource(workbenchExampleResources.tickets) },
  );
  ctx.commands.registerCommand(
    { id: "project.openSettings", label: "Open settings", category: "Project", icon: "Settings" },
    { execute: () => ctx.resources.openResource(workbenchExampleResources.settings) },
  );
  ctx.commands.registerCommand(
    { id: "project.openRegistryInventory", label: "Open registry inventory", category: "Workbench", icon: "Boxes" },
    { execute: () => ctx.resources.openResource(workbenchExampleResources.registryInventory) },
  );
  ctx.commands.registerCommand(
    { id: "project.showNotification", label: "Show workbench notification", category: "Workbench", icon: "Bell" },
    {
      execute: () =>
        ctx.notifications.show({
          id: "project.registry-sync",
          level: "warning",
          title: "Registry sync needs attention",
          message: "Two runtime extension resources were indexed with warnings.",
          resource: workbenchExampleResources.registryInventory,
          actions: [{ commandId: "project.openRegistryInventory", title: "Open inventory" }],
        }),
    },
  );
  ctx.commands.registerCommand(
    { id: "project.runChecks", label: "Run checks", category: "Project", icon: "ListChecks" },
    {
      execute: () => {
        ctx.notifications.show({
          level: "success",
          title: "Workbench checks completed",
          message: "Commands, menus, layout, resources, trees, and notifications are wired.",
          resource: workbenchExampleResources.project,
          actions: [{ commandId: "project.openRegistryInventory", title: "Open inventory" }],
        });
        return ctx.layout.openWidget(workbenchWidgetIds.checks);
      },
    },
  );
  ctx.commands.registerCommand(
    { id: "project.togglePreview", label: "Toggle preview context", category: "Workbench", icon: "PanelRight" },
    {
      execute: () => {
        const nextValue = !ctx.context.get("project.previewOpen");
        ctx.context.set("project.previewOpen", nextValue);
      },
      isToggled: () => Boolean(ctx.context.get("project.previewOpen")),
    },
  );
  ctx.commands.registerCommand(
    { id: "project.openDocs", label: "Open docs", category: "Help", icon: "BookOpen" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Opening workbench docs" }) },
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

const registerProjectRegistries = (ctx: WorkbenchModuleContributionContext) => {
  ctx.resources.registerKind({ kind: "project", label: "Project", icon: "FolderGit2" });
  ctx.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view", icon: "KanbanSquare" });
  ctx.resources.registerKind({ kind: "ticket", label: "Ticket", icon: "Ticket" });
  ctx.resources.registerKind({ kind: "workspace", label: "Workspace", icon: "GitBranch" });
  ctx.resources.registerKind({ kind: "settings", label: "Settings", icon: "Settings" });
  ctx.resources.registerOpener({
    id: "project.resourceOpener",
    priority: 100,
    canOpen: (resource) => ["project", "dashboard-view", "ticket", "workspace", "settings"].includes(resource.kind),
    open: (resource, input) =>
      ctx.layout.openWidget(resolveProjectWidget(resource), {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      }),
  });

  registerReactWidget(ctx, workbenchWidgetIds.overview, "Project overview", "main", 100);
  registerReactWidget(ctx, workbenchWidgetIds.tickets, "Tickets", "main", 90);
  registerReactWidget(ctx, workbenchWidgetIds.workspace, "Workspace PS-266", "main", 80);
  registerReactWidget(ctx, workbenchWidgetIds.settings, "Project settings", "main", 70);
  registerReactWidget(ctx, workbenchWidgetIds.registryInventory, "Registry inventory", "main", 60);
  registerReactWidget(ctx, workbenchWidgetIds.checks, "Checks", "main-bottom", 50);
  registerReactWidget(ctx, workbenchWidgetIds.session, "Session A", "floating", 40);
};

const registerProjectNavigation = (ctx: WorkbenchModuleContributionContext) => {
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
            id: workbenchExampleResources.project.uri,
            label: "Overview",
            icon: "KanbanSquare",
            resource: workbenchExampleResources.project,
          },
          {
            id: workbenchExampleResources.tickets.uri,
            label: "Tickets",
            icon: "KanbanSquare",
            resource: workbenchExampleResources.tickets,
          },
          { id: "workspace-group", label: "Workspaces", icon: "GitBranch", collapsible: true },
        ],
      },
      {
        id: "registries",
        label: "Workbench registries",
        nodes: [
          {
            id: workbenchExampleResources.registryInventory.uri,
            label: "Inventory",
            icon: "Boxes",
            resource: workbenchExampleResources.registryInventory,
          },
          {
            id: workbenchExampleResources.extensionReview.uri,
            label: "Extension review",
            icon: "Puzzle",
            resource: workbenchExampleResources.extensionReview,
          },
        ],
      },
    ],
    getChildren: (node) =>
      node.id === "workspace-group"
        ? [
            {
              id: workbenchExampleResources.workspace.uri,
              label: "PS-266 workbench examples",
              icon: "GitBranch",
              resource: workbenchExampleResources.workspace,
            },
            {
              id: workbenchExampleResources.workspace267.uri,
              label: "PS-267 extension webviews",
              icon: "GitBranch",
              resource: workbenchExampleResources.workspace267,
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
            id: workbenchExampleResources.settings.uri,
            label: "Settings",
            icon: "Settings",
            resource: workbenchExampleResources.settings,
          },
          { id: "help", label: "Help", icon: "CircleHelp", menuPath: helpMenuPath },
        ],
      },
    ],
    getChildren: () => [],
  });
};

const registerProjectPreferences = (ctx: WorkbenchModuleContributionContext) => {
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

const registerProjectMenusAndKeybindings = (ctx: WorkbenchModuleContributionContext) => {
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.openOverview", order: 10 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.openTickets", order: 20 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.openRegistryInventory", order: 30 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.showNotification", order: 40 });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId: "project.runChecks", order: 50 });
  ctx.menus.registerMenuAction(resourceContextMenuPath, { commandId: "project.openSettings", order: 10 });
  ctx.menus.registerMenuAction(helpMenuPath, { commandId: "project.openDocs", order: 10 });
  ctx.menus.registerMenuAction(helpMenuPath, { commandId: "project.openShortcuts", order: 20 });
  ctx.menus.registerMenuAction(helpMenuPath, { commandId: "project.contactSupport", order: 30 });
  ctx.keybindings.registerKeybinding({ commandId: "project.openOverview", keybinding: "mod+1", when: "project.open" });
  ctx.keybindings.registerKeybinding({ commandId: "project.openTickets", keybinding: "mod+2", when: "project.open" });
  ctx.keybindings.registerKeybinding({
    commandId: "project.runChecks",
    keybinding: "mod+shift+b",
    when: "project.open && project.previewOpen",
  });
};

const registerExtensionLabContributions = (ctx: WorkbenchModuleContributionContext) => {
  const commandId = "extension-lab.review.open";

  ctx.resources.registerKind({ kind: "extension-review", label: "Extension review", icon: "Puzzle" });
  ctx.commands.registerCommand(
    { id: commandId, label: "Open extension review", category: "Extensions", icon: "Puzzle" },
    { execute: () => ctx.resources.openResource(workbenchExampleResources.extensionReview) },
  );
  ctx.layout.registerWidget({
    id: workbenchWidgetIds.extensionReview,
    title: "Extension Lab review",
    area: "main",
    resourceKinds: ["extension-review"],
    rendererId: workbenchWidgetIds.extensionReview,
  });
  ctx.resources.registerOpener({
    id: "extension.reviewOpener",
    priority: 80,
    canOpen: (resource) => resource.kind === "extension-review",
    open: (resource, input) =>
      ctx.layout.openWidget(workbenchWidgetIds.extensionReview, {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      }),
  });
  ctx.menus.registerMenuAction(commandPaletteMenuPath, { commandId, group: "Extensions", order: 80 });
  ctx.keybindings.registerKeybinding({ commandId, keybinding: "mod+shift+e", when: "project.open" });
  ctx.preferences.registerSchema({
    properties: {
      "extensionLab.reviewMode": {
        type: "string",
        enum: ["standard", "strict"],
        default: "standard",
        scope: "project",
      },
    },
  });
  ctx.preferences.setValue("extensionLab.reviewMode", "strict", projectScope);
};

export const createConsumerExampleModule = (): WorkbenchModuleContribution => ({
  id: "consumer-example",
  activate(ctx) {
    ctx.sessionPanel.setMode("attached");
    ctx.context.set("project.open", true);
    ctx.context.set("project.previewOpen", true);
    ctx.context.set("selection.kind", "ticket");

    registerProjectRegistries(ctx);
    registerProjectCommands(ctx);
    registerProjectMenusAndKeybindings(ctx);
    registerProjectPreferences(ctx);
    registerProjectNavigation(ctx);
    registerExtensionLabContributions(ctx);

    void ctx.lifecycle.runHooks("activate");

    registerConsumerWorkbenchRenderers(
      ctx,
      workbenchExampleTickets.map((ticket) => ticket.resource.id),
    );

    ctx.layout.openWidget(workbenchWidgetIds.session);
    ctx.layout.openWidget(workbenchWidgetIds.checks);
    ctx.layout.openWidget(workbenchWidgetIds.overview, {
      resource: workbenchExampleResources.project,
    });
  },
});
