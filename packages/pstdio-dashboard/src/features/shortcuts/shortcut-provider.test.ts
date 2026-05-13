import { describe, expect, it, mock } from "bun:test";
import { createShellCore } from "pstdio-shell/core";
import { createDashboardProjectShell } from "@/shared/shell/dashboard-project-shell";
import {
  openSessionCreateFlow,
  openTicketCreateFlow,
  registerShortcutBindings,
  shouldLoadTicketsForShortcuts,
} from "./shortcut-provider";

const createHotkeyManager = () => {
  const handlers = new Map<
    string,
    { handler: (event: { target?: EventTarget | null; preventDefault?: () => void }) => void; options: unknown }
  >();

  return {
    handlers,
    register: (
      binding: string,
      handler: (event: { target?: EventTarget | null; preventDefault?: () => void }) => void,
      options: unknown,
    ) => {
      handlers.set(binding, { handler, options });
      return { unregister: mock(() => {}) };
    },
  };
};

const baseInput = {
  isHelpOpen: false,
};

const createBooleanSetter = () => mock((_value: boolean) => {});
const createCommandPaletteViewSetter = () => mock((_value: "main" | "theme") => {});
const createQuerySetter = () => mock((_value: string) => {});

describe("registerShortcutBindings - creation and navigation", () => {
  it("opens create ticket flow and navigates to tickets", () => {
    const requestCreateTicket = mock(() => {});
    const navigate = mock(() => {});

    openTicketCreateFlow({
      projectId: "project-1",
      pathname: "/projects/project-1/settings",
      requestCreateTicket,
      navigate: navigate as never,
    });

    expect(requestCreateTicket).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$projectId/tickets", params: { projectId: "project-1" } });
  });

  it("opens create session flow and keeps users in sessions route", () => {
    const setSelectedSessionId = mock((_sessionId: string | null) => {});
    const setSessionModalState = mock((_state: "bubble" | "closed" | "attached") => {});
    const navigate = mock(() => {});

    openSessionCreateFlow({
      projectId: "project-1",
      pathname: "/projects/project-1/sessions/abc",
      setSelectedSessionId,
      setSessionModalState,
      navigate: navigate as never,
    });

    expect(setSelectedSessionId).toHaveBeenCalledWith(null);
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$projectId/sessions", params: { projectId: "project-1" } });
    expect(setSessionModalState).not.toHaveBeenCalled();
  });

  it("navigates to tickets with Ctrl+Shift+T", () => {
    const hotkeyManager = createHotkeyManager();
    const navigations: string[] = [];
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      navigate: (path) => navigations.push(path),
    });

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      activeScopes: ["global"],
      shell,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+T")?.handler({ target: null, preventDefault: () => {} });

    expect(navigations).toEqual(["/projects/project-1/tickets"]);
  });

  it("opens the theme menu with Ctrl+Shift+K", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsCommandPaletteOpen = createBooleanSetter();
    const setCommandPaletteView = createCommandPaletteViewSetter();
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      navigate: () => {},
      openThemeMenu: () => {
        setCommandPaletteView("theme");
        setIsCommandPaletteOpen(true);
      },
    });

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      activeScopes: ["global"],
      shell,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+K")?.handler({ target: null, preventDefault: () => {} });

    expect(setCommandPaletteView).toHaveBeenCalledWith("theme");
    expect(setIsCommandPaletteOpen).toHaveBeenCalledWith(true);
  });
});

describe("registerShortcutBindings - overlay and sibling navigation", () => {
  it("closes help overlay on Escape when overlay is active", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsHelpOpen = createBooleanSetter();
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      navigate: () => {},
      closeOverlay: () => setIsHelpOpen(false),
    });

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      activeScopes: ["global"],
      isHelpOpen: true,
      shell,
    });

    hotkeyManager.handlers.get("Escape")?.handler({ target: null });

    expect(setIsHelpOpen).toHaveBeenCalledWith(false);
  });

  it("opens help on Ctrl+Shift+H and ignores editable targets", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsHelpOpen = createBooleanSetter();
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      navigate: () => {},
      openShortcutHelp: () => setIsHelpOpen(true),
    });
    const nestedTextNodeInsideEditable = {
      nodeType: 3,
      parentElement: {
        tagName: "SPAN",
        parentElement: {
          tagName: "DIV",
          isContentEditable: true,
        },
      },
    } as unknown as EventTarget;

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      activeScopes: ["global"],
      shell,
    });

    hotkeyManager.handlers
      .get("Ctrl+Shift+H")
      ?.handler({ target: { tagName: "INPUT", type: "text" } as unknown as EventTarget, preventDefault: () => {} });
    hotkeyManager.handlers
      .get("Ctrl+Shift+H")
      ?.handler({ target: nestedTextNodeInsideEditable, preventDefault: () => {} });
    hotkeyManager.handlers
      .get("Ctrl+Shift+H")
      ?.handler({ target: { tagName: "BUTTON" } as unknown as EventTarget, preventDefault: () => {} });

    expect(setIsHelpOpen).toHaveBeenCalledTimes(1);
    expect(setIsHelpOpen).toHaveBeenCalledWith(true);
  });

  it("opens the command palette on Ctrl+Shift+P and prevents default", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsCommandPaletteOpen = createBooleanSetter();
    const setCommandPaletteInitialQuery = createQuerySetter();
    const preventDefault = mock(() => {});
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      navigate: () => {},
      openCommandPalette: () => {
        setCommandPaletteInitialQuery("");
        setIsCommandPaletteOpen(true);
      },
    });

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      activeScopes: ["global"],
      shell,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+P")?.handler({ target: null, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(setIsCommandPaletteOpen).toHaveBeenCalledWith(true);
    expect(setCommandPaletteInitialQuery).toHaveBeenCalledWith("");
  });

  it("opens the command palette in command mode on Ctrl+Shift+.", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsCommandPaletteOpen = createBooleanSetter();
    const setCommandPaletteView = createCommandPaletteViewSetter();
    const setCommandPaletteInitialQuery = createQuerySetter();
    const preventDefault = mock(() => {});
    const shell = createDashboardProjectShell({
      projectId: "project-1",
      navigate: () => {},
      openCommandPaletteCommands: () => {
        setCommandPaletteView("main");
        setCommandPaletteInitialQuery("> ");
        setIsCommandPaletteOpen(true);
      },
    });

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      activeScopes: ["global"],
      shell,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+.")?.handler({ target: null, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(setCommandPaletteView).toHaveBeenCalledWith("main");
    expect(setCommandPaletteInitialQuery).toHaveBeenCalledWith("> ");
    expect(setIsCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  it("executes active shell keybindings", () => {
    const hotkeyManager = createHotkeyManager();
    const preventDefault = mock(() => {});
    const seen: string[] = [];
    const shell = createShellCore();

    shell.commands.registerCommand(
      { id: "project.openSettings", label: "Project settings" },
      { execute: () => seen.push("project.openSettings") },
    );
    shell.keybindings.registerKeybinding({
      commandId: "project.openSettings",
      keybinding: "Ctrl+Shift+,",
    });

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      activeScopes: ["global"],
      shell,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+,")?.handler({ target: null, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["project.openSettings"]);
  });
});

describe("shouldLoadTicketsForShortcuts", () => {
  it("loads ticket data for global project routes", () => {
    expect(shouldLoadTicketsForShortcuts(["global"], "project-1")).toBe(true);
  });

  it("does not load ticket data without project context", () => {
    expect(shouldLoadTicketsForShortcuts(["global"], undefined)).toBe(false);
  });

  it("does not load ticket data when scope is inactive", () => {
    expect(shouldLoadTicketsForShortcuts([], "project-1")).toBe(false);
  });
});
