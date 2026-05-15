import { describe, expect, it } from "bun:test";
import {
  DASHBOARD_COMMAND_RESOURCE_KIND,
  PROJECT_NAVIGATION_FOOTER_TREE_ID,
  PROJECT_NAVIGATION_HEADER_WIDGET_ID,
  PROJECT_NAVIGATION_TREE_ID,
  PROJECT_OPEN_SETTINGS_COMMAND_ID,
  PROJECT_RESOURCE_KIND,
  PROJECT_ROUTE_RESOURCE_KIND,
  PROJECT_SETTINGS_WIDGET_ID,
} from "./dashboard-project-shell";
import { createDashboardShell, DASHBOARD_MODE_IDS } from "./dashboard-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";
import {
  createSessionResource,
  createSessionsResource,
  SESSION_RESOURCE_KIND,
  SESSIONS_CHAT_WIDGET_ID,
  SESSIONS_CREATE_COMMAND_ID,
  SESSIONS_NAVIGATION_TREE_ID,
  SESSIONS_OPEN_COMMAND_ID,
  SESSIONS_RESOURCE_KIND,
} from "./sessions/dashboard-sessions-module";
import { applyRouteActivation, resolveRouteActivation } from "./tanstack-shell-adapter";
import {
  createTicketDetailsResource,
  TICKET_DETAILS_MAIN_WIDGET_ID,
  TICKET_DETAILS_NAVIGATION_TREE_ID,
  TICKET_DETAILS_OPEN_COMMAND_ID,
  TICKET_DETAILS_RESOURCE_KIND,
} from "./ticket-details/dashboard-ticket-details-module";
import {
  createTicketsResource,
  TICKETS_CREATE_COMMAND_ID,
  TICKETS_MAIN_WIDGET_ID,
  TICKETS_OPEN_COMMAND_ID,
  TICKETS_RESOURCE_KIND,
} from "./tickets/dashboard-tickets-module";

const createInMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const activeMenuCommandIds = (shell: ReturnType<typeof createDashboardShell>) =>
  shell.menus
    .listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU)
    .filter((action) => shell.context.matches(action.when))
    .map((action) => action.commandId);

describe("createDashboardShell project chrome", () => {
  it("registers project chrome in the unified shell and activates it from project routes", async () => {
    const navigations: string[] = [];
    const shell = createDashboardShell({
      storage: createInMemoryStorage(),
      navigate: (path) => navigations.push(path),
      projectName: "Prompt Studio",
    });

    expect(shell.resources.getKind(PROJECT_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.resources.getKind(PROJECT_ROUTE_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.resources.getKind(DASHBOARD_COMMAND_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.layout.getWidget(PROJECT_SETTINGS_WIDGET_ID)?.rendererId).toBe(PROJECT_SETTINGS_WIDGET_ID);
    expect(shell.layout.getWidget(PROJECT_NAVIGATION_HEADER_WIDGET_ID)?.rendererId).toBe(
      PROJECT_NAVIGATION_HEADER_WIDGET_ID,
    );
    expect(shell.commands.getCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID)?.command.label).toBe("Project settings");
    expect(shell.keybindings.listActiveKeybindings()).toEqual([]);
    expect(activeMenuCommandIds(shell)).not.toContain(PROJECT_OPEN_SETTINGS_COMMAND_ID);

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/project-1/tickets" }));

    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectNavigation);
    expect(shell.layout.getLayout().areas["left-header"].widgets.map((widget) => widget.contributionId)).toEqual([
      PROJECT_NAVIGATION_HEADER_WIDGET_ID,
    ]);
    expect(
      shell.keybindings.listActiveKeybindings().map(({ commandId, keybinding }) => ({ commandId, keybinding })),
    ).toEqual([
      { commandId: "dashboard.closeOverlay", keybinding: "Escape" },
      { commandId: "project.createTicket", keybinding: "Ctrl+Shift+C" },
      { commandId: "project.createSession", keybinding: "Ctrl+Shift+S" },
      { commandId: "project.goToTickets", keybinding: "Ctrl+Shift+T" },
      { commandId: "dashboard.openCommandPalette", keybinding: "Ctrl+Shift+P" },
      { commandId: "dashboard.openCommandPaletteCommands", keybinding: "Ctrl+Shift+." },
      { commandId: "dashboard.changeTheme", keybinding: "Ctrl+Shift+K" },
      { commandId: "dashboard.openShortcutHelp", keybinding: "Ctrl+Shift+H" },
      { commandId: PROJECT_OPEN_SETTINGS_COMMAND_ID, keybinding: "Ctrl+Shift+," },
    ]);
    expect(activeMenuCommandIds(shell)).toContain(PROJECT_OPEN_SETTINGS_COMMAND_ID);

    const [root] = await shell.trees.getRoots(PROJECT_NAVIGATION_TREE_ID);
    const sections = await shell.trees.getSections(PROJECT_NAVIGATION_TREE_ID);
    const footerSections = await shell.trees.getSections(PROJECT_NAVIGATION_FOOTER_TREE_ID);

    expect(root?.resource?.uri).toBe("pstdio://project/project-1");
    expect(sections[0]?.nodes.map((node) => node.resource?.uri)).toEqual([
      "pstdio://project/project-1/command/dashboard.openCommandPalette",
      "pstdio://project/project-1/tickets",
    ]);
    expect(footerSections[0]?.nodes.map((node) => node.resource?.uri)).toEqual([
      "pstdio://project/project-1/command/dashboard.openShortcutHelp",
      "pstdio://project/project-1/sessions",
      "pstdio://project/project-1/settings",
    ]);

    const projectResource = shell.navigation.resolveLocation("pstdio://project/project-1");
    expect(projectResource).toMatchObject({
      kind: PROJECT_RESOURCE_KIND,
      id: "project-1",
      label: "Prompt Studio",
    });
    expect(shell.navigation.createHref(projectResource)).toBe("/projects/project-1/settings");

    await shell.commands.executeCommand(PROJECT_OPEN_SETTINGS_COMMAND_ID);
    expect(navigations).toEqual(["/projects/project-1/settings"]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(PROJECT_SETTINGS_WIDGET_ID);

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects" }));

    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectsList);
    expect(shell.context.get("projectId")).toBeUndefined();
    expect(shell.keybindings.listActiveKeybindings()).toEqual([]);
    expect(shell.layout.getLayout().areas["left-header"].widgets).toEqual([]);
  });
});

describe("createDashboardShell ticket modes", () => {
  it("opens the ticket list widget from the unified project navigation mode", async () => {
    const navigations: string[] = [];
    let createRequests = 0;
    const shell = createDashboardShell({
      storage: createInMemoryStorage(),
      navigate: (path) => navigations.push(path),
      requestCreateTicket: () => {
        createRequests += 1;
      },
    });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/proj-1/tickets" }));

    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectNavigation);
    expect(shell.resources.getKind(TICKETS_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.layout.getWidget(TICKETS_MAIN_WIDGET_ID)).toMatchObject({
      area: "main",
    });
    expect(shell.layout.getLayout().activeWidgetId).toBe(TICKETS_MAIN_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/tickets");
    expect(shell.commands.getCommand(TICKETS_OPEN_COMMAND_ID)?.command.label).toBe("Open tickets");
    expect(shell.commands.getCommand(TICKETS_CREATE_COMMAND_ID)?.command.label).toBe("New ticket");

    await shell.resources.openResource(createTicketsResource("proj-1"));
    await shell.commands.executeCommand(TICKETS_CREATE_COMMAND_ID);

    expect(navigations).toEqual(["/projects/proj-1/tickets"]);
    expect(createRequests).toBe(1);
  });

  it("opens ticket details in a dedicated unified mode with the ticket navigation tree", async () => {
    const navigations: string[] = [];
    const shell = createDashboardShell({
      storage: createInMemoryStorage(),
      navigate: (path) => navigations.push(path),
    });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/proj-1/tickets/PS-42" }));

    expect(shell.modes.getActiveModeId()).toBe("project.ticket-details");
    expect(shell.resources.getKind(TICKET_DETAILS_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.trees.getTreeView(TICKET_DETAILS_NAVIGATION_TREE_ID)).toMatchObject({
      area: "left",
      icon: "FileText",
    });
    expect(shell.layout.getWidget(TICKET_DETAILS_MAIN_WIDGET_ID)).toMatchObject({
      area: "main",
    });
    expect(shell.layout.getLayout().activeWidgetId).toBe(TICKET_DETAILS_MAIN_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/ticket/PS-42");
    expect(shell.commands.getCommand(TICKET_DETAILS_OPEN_COMMAND_ID)?.command.label).toBe("Open ticket");

    await shell.resources.openResource(createTicketDetailsResource("proj-1", "PS-43", "Follow up"));

    expect(navigations).toEqual(["/projects/proj-1/tickets/PS-43"]);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/ticket/PS-43");
  });
});

describe("createDashboardShell session mode", () => {
  it("opens project sessions in the unified shell with the sessions navigation tree", async () => {
    const navigations: string[] = [];
    const shell = createDashboardShell({
      storage: createInMemoryStorage(),
      navigate: (path) => navigations.push(path),
    });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/proj-1/tickets" }));
    expect(shell.trees.getTreeView(PROJECT_NAVIGATION_TREE_ID)).toBeDefined();

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/proj-1/sessions/session-1" }));

    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectSessions);
    expect(shell.resources.getKind(SESSIONS_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.resources.getKind(SESSION_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.trees.getTreeView(SESSIONS_NAVIGATION_TREE_ID)).toMatchObject({
      area: "left",
      icon: "MessageCircle",
    });
    expect(shell.trees.getTreeView(PROJECT_NAVIGATION_TREE_ID)).toBeUndefined();
    expect(shell.layout.getWidget(SESSIONS_CHAT_WIDGET_ID)).toMatchObject({
      area: "main",
    });
    expect(shell.layout.getLayout().areas["left-header"].widgets.map((widget) => widget.contributionId)).toEqual([
      PROJECT_NAVIGATION_HEADER_WIDGET_ID,
    ]);
    expect(shell.layout.getLayout().activeWidgetId).toBe(SESSIONS_CHAT_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/session/session-1");
    expect(shell.commands.getCommand(SESSIONS_OPEN_COMMAND_ID)?.command.label).toBe("Open sessions");
    expect(shell.commands.getCommand(SESSIONS_CREATE_COMMAND_ID)?.command.label).toBe("New session");

    await shell.resources.openResource(createSessionsResource("proj-1"));
    await shell.resources.openResource(createSessionResource("proj-1", "session-2", "Follow-up"));

    expect(navigations).toEqual(["/projects/proj-1/sessions", "/projects/proj-1/sessions/session-2"]);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/session/session-2");
  });
});
