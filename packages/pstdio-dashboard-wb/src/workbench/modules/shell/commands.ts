import { type WorkbenchModuleContributionContext, workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { readRuntimeConfig } from "@/lib/api";
import { dashboardHelpMenuPath, dashboardWorkspaceMenuPath } from "../../shared/menu-paths";
import { dashboardResources } from "../../shared/mock-data/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { dashboardWorkspaces } from "../workspaces/mock-data/workspaces";

const GITHUB_DOCS_URL = "https://github.com/pufflyai/prompt-studio";
const DISCORD_URL = "https://discord.gg/3RxwUEk8fW";
export const DASHBOARD_HELP_SHORTCUT_KEYBINDING = "Ctrl+Shift+H";

export const getDashboardVersion = () => {
  const runtimeVersion = readRuntimeConfig()?.version?.trim();
  if (runtimeVersion) return runtimeVersion;

  const buildVersion = import.meta.env?.VITE_APP_VERSION?.trim();
  return buildVersion && buildVersion.length > 0 ? buildVersion : "dev";
};

export const getDashboardVersionLabel = (version = getDashboardVersion()) => `v${version}`;

export const openDashboardHelpLink = (
  url: string,
  open: (url: string, target: string, features: string) => unknown,
) => {
  open(url, "_blank", "noopener,noreferrer");
};

const openHelpLink = (url: string) => {
  openDashboardHelpLink(url, window.open.bind(window));
};

export const registerCommands = (ctx: WorkbenchModuleContributionContext) => {
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
    { execute: () => ctx.resources.openResource(dashboardWorkspaces[0].resource, { replaceActive: true }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.createWorkspace", label: "Add manual workspace", category: "Dashboard", icon: "Plus" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Manual workspace creation queued" }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.deleteWorkspace", label: "Delete workspace", category: "Dashboard", icon: "Trash2" },
    { execute: () => ctx.notifications.show({ level: "warning", title: "Workspace deletion queued" }) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.createSession", label: "Create session", category: "Dashboard", icon: "PenBox" },
    { execute: () => ctx.notifications.show({ level: "info", title: "Session draft created" }) },
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
    { id: "dashboard.openShortcuts", label: "Keyboard shortcuts", category: "Help", icon: "CircleHelp" },
    { execute: () => ctx.layout.openWidget(dashboardWidgetIds.shortcutHelp, { title: "Keyboard shortcuts" }) },
  );
  ctx.keybindings.registerKeybinding({
    commandId: "dashboard.openShortcuts",
    keybinding: DASHBOARD_HELP_SHORTCUT_KEYBINDING,
    when: "!inputFocus",
  });
  ctx.commands.registerCommand(
    { id: "dashboard.openDocs", label: "Documentation", category: "Help", icon: "BookOpen" },
    { execute: () => openHelpLink(GITHUB_DOCS_URL) },
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
    { id: "dashboard.openDiscord", label: "Discord", category: "Help", icon: "MessageCircle" },
    { execute: () => openHelpLink(DISCORD_URL) },
  );
  ctx.commands.registerCommand(
    { id: "dashboard.productInfo", label: "Prompt Studio", category: "Help", description: getDashboardVersionLabel() },
    { execute: () => undefined, isEnabled: () => false },
  );
};

export const registerMenus = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openWorkspaces", order: 10 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "dashboard.openCurrentWorkspace",
    order: 20,
  });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openSessions", order: 30 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openSettings", order: 40 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.sayHello", order: 50 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.runHealthScan", order: 60 });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: "dashboard.openRepoHealth", order: 70 });
  ctx.layout.registerMenuItem(dashboardWorkspaceMenuPath, {
    commandId: "dashboard.deleteWorkspace",
    group: "overflow",
    overflowLabel: "Workspace actions",
    order: 10,
  });
  ctx.layout.registerMenuItem(dashboardHelpMenuPath, { commandId: "dashboard.openShortcuts", order: 10 });
  ctx.layout.registerMenuItem(dashboardHelpMenuPath, { commandId: "dashboard.openDocs", order: 20, external: true });
  ctx.layout.registerMenuItem(dashboardHelpMenuPath, {
    commandId: "dashboard.openDiscord",
    order: 30,
    external: true,
  });
  ctx.layout.registerMenuItem(dashboardHelpMenuPath, {
    commandId: "dashboard.productInfo",
    label: "Prompt Studio",
    description: getDashboardVersionLabel(),
    iconSrc: "/logo.svg",
    readOnly: true,
    order: 40,
  });
};
