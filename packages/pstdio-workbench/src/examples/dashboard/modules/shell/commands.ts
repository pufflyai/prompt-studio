import {
  type MenuPath,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "../../../../core";
import { dashboardResources } from "../../shared/mock-data/resources";
import { dashboardTickets } from "../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../shared/widget-ids";

export const dashboardHelpMenuPath = ["dashboardWorkbench", "help"] as const satisfies MenuPath;

export const registerCommands = (ctx: WorkbenchModuleContributionContext) => {
  ctx.commands.registerCommand(
    { id: "dashboard.openTickets", label: "Open tickets", category: "Dashboard", icon: "KanbanSquare" },
    { execute: () => ctx.resources.openResource(dashboardResources.tickets, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openWorkspaces", label: "Open workspaces", category: "Dashboard", icon: "GitBranch" },
    { execute: () => ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openSessions", label: "Open sessions", category: "Dashboard", icon: "MessageCircle" },
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
    { id: "dashboard.openFile", label: "Open file", category: "Dashboard", icon: "FileText" },
    {
      execute: (args) => {
        const { path } = args as { path: string };
        ctx.notifications.show({ level: "info", title: `Opened ${path}` });
      },
    },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.openSession", label: "Open session", category: "Dashboard", icon: "MessageCircle" },
    { execute: () => ctx.layout.openWidget(dashboardWidgetIds.session, { pinned: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.contactSupport", label: "Contact support", category: "Help", icon: "MessageSquare" },
    { execute: () => ctx.notifications.show({ level: "success", title: "Support request started" }) },
  );
};

export const registerMenus = (ctx: WorkbenchModuleContributionContext) => {
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
