import { describe, expect, it, mock } from "bun:test";
import { registerShortcutBindings, shouldLoadTicketsForShortcuts } from "./shortcut-provider";

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
  projectId: "project-1",
  isHelpOpen: false,
  requestCreateTicket: () => {},
  setSelectedSessionId: () => {},
  setSessionModalState: () => {},
  setIsHelpOpen: () => {},
  setIsCommandPaletteOpen: () => {},
  setCommandPaletteView: () => {},
  navigate: (() => {}) as never,
  currentTicket: null,
  currentTicketIndex: -1,
  currentWorkspaceIndex: -1,
  visibleTickets: [],
  workspaceShorthand: undefined,
};

describe("registerShortcutBindings - creation and navigation", () => {
  it("opens create ticket flow and navigates to tickets", () => {
    const hotkeyManager = createHotkeyManager();
    const requestCreateTicket = mock(() => {});
    const navigate = mock(() => {});
    const preventDefault = mock(() => {});

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      pathname: "/projects/project-1/settings",
      activeScopes: ["global"],
      requestCreateTicket,
      navigate: navigate as never,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+C")?.handler({ target: null, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(requestCreateTicket).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$projectId/tickets", params: { projectId: "project-1" } });
  });

  it("opens create session flow and keeps users in sessions route", () => {
    const hotkeyManager = createHotkeyManager();
    const setSelectedSessionId = mock(() => {});
    const setSessionModalState = mock(() => {});
    const navigate = mock(() => {});

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      pathname: "/projects/project-1/sessions/abc",
      activeScopes: ["global"],
      setSelectedSessionId,
      setSessionModalState,
      navigate: navigate as never,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+S")?.handler({ target: null, preventDefault: () => {} });

    expect(setSelectedSessionId).toHaveBeenCalledWith(null);
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$projectId/sessions", params: { projectId: "project-1" } });
    expect(setSessionModalState).not.toHaveBeenCalled();
  });

  it("navigates to tickets with Ctrl+Shift+T", () => {
    const hotkeyManager = createHotkeyManager();
    const navigate = mock(() => {});

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      pathname: "/projects/project-1/settings",
      activeScopes: ["global"],
      navigate: navigate as never,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+T")?.handler({ target: null, preventDefault: () => {} });

    expect(navigate).toHaveBeenCalledWith({
      to: "/projects/$projectId/tickets",
      params: { projectId: "project-1" },
    });
  });

  it("opens the theme menu with Ctrl+Shift+K", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsCommandPaletteOpen = mock(() => {});
    const setCommandPaletteView = mock(() => {});

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      pathname: "/projects/project-1/settings",
      activeScopes: ["global"],
      setIsCommandPaletteOpen,
      setCommandPaletteView,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+K")?.handler({ target: null, preventDefault: () => {} });

    expect(setCommandPaletteView).toHaveBeenCalledWith("theme");
    expect(setIsCommandPaletteOpen).toHaveBeenCalledWith(true);
  });
});

describe("registerShortcutBindings - overlay and sibling navigation", () => {
  it("closes help overlay on Escape when overlay is active", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsHelpOpen = mock(() => {});

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      pathname: "/projects/project-1/tickets",
      activeScopes: ["global"],
      isHelpOpen: true,
      setIsHelpOpen,
    });

    hotkeyManager.handlers.get("Escape")?.handler({ target: null });

    expect(setIsHelpOpen).toHaveBeenCalledWith(false);
  });

  it("opens help on Ctrl+Shift+H and ignores editable targets", () => {
    const hotkeyManager = createHotkeyManager();
    const setIsHelpOpen = mock(() => {});
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
      pathname: "/projects/project-1/tickets",
      activeScopes: ["global"],
      setIsHelpOpen,
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
    const setIsCommandPaletteOpen = mock(() => {});
    const preventDefault = mock(() => {});

    registerShortcutBindings({
      ...baseInput,
      hotkeyManager: hotkeyManager as never,
      pathname: "/projects/project-1/tickets",
      activeScopes: ["global"],
      setIsCommandPaletteOpen,
    });

    hotkeyManager.handlers.get("Ctrl+Shift+P")?.handler({ target: null, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(setIsCommandPaletteOpen).toHaveBeenCalledWith(true);
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
