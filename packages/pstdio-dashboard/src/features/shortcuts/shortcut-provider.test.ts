import { describe, expect, it, mock } from "bun:test";
import { registerShortcutBindings, shouldLoadTicketsForShortcuts } from "./shortcut-provider";

const createHotkeyManager = () => {
  const handlers = new Map<string, { handler: (event: { target?: EventTarget | null }) => void; options: unknown }>();

  return {
    handlers,
    register: (binding: string, handler: (event: { target?: EventTarget | null }) => void, options: unknown) => {
      handlers.set(binding, { handler, options });
      return { unregister: mock(() => {}) };
    },
  };
};

const createSequenceManager = () => {
  const handlers = new Map<string, { handler: () => void; options: unknown }>();

  return {
    handlers,
    register: (binding: string[], handler: () => void, options: unknown) => {
      handlers.set(binding.join(","), { handler, options });
      return { unregister: mock(() => {}) };
    },
  };
};

describe("registerShortcutBindings - creation and sequence flows", () => {
  it("opens create ticket flow and navigates to tickets", () => {
    const hotkeyManager = createHotkeyManager();
    const sequenceManager = createSequenceManager();
    const requestCreateTicket = mock(() => {});
    const navigate = mock(() => {});

    registerShortcutBindings({
      hotkeyManager: hotkeyManager as never,
      sequenceManager: sequenceManager as never,
      projectId: "project-1",
      pathname: "/projects/project-1/settings",
      activeScopes: ["global"],
      isHelpOpen: false,
      requestCreateTicket,
      setSelectedSessionId: () => {},
      setSessionModalState: () => {},
      setIsHelpOpen: () => {},
      navigate: navigate as never,
      currentTicket: null,
      currentTicketIndex: -1,
      currentWorkspaceIndex: -1,
      visibleTickets: [],
      workspaceShorthand: undefined,
    });

    hotkeyManager.handlers.get("C")?.handler({ target: null });

    expect(requestCreateTicket).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$projectId/tickets", params: { projectId: "project-1" } });
  });

  it("opens create session flow and keeps users in sessions route", () => {
    const hotkeyManager = createHotkeyManager();
    const sequenceManager = createSequenceManager();
    const setSelectedSessionId = mock(() => {});
    const setSessionModalState = mock(() => {});
    const navigate = mock(() => {});

    registerShortcutBindings({
      hotkeyManager: hotkeyManager as never,
      sequenceManager: sequenceManager as never,
      projectId: "project-1",
      pathname: "/projects/project-1/sessions/abc",
      activeScopes: ["global"],
      isHelpOpen: false,
      requestCreateTicket: () => {},
      setSelectedSessionId,
      setSessionModalState,
      setIsHelpOpen: () => {},
      navigate: navigate as never,
      currentTicket: null,
      currentTicketIndex: -1,
      currentWorkspaceIndex: -1,
      visibleTickets: [],
      workspaceShorthand: undefined,
    });

    hotkeyManager.handlers.get("S")?.handler({ target: null });

    expect(setSelectedSessionId).toHaveBeenCalledWith(null);
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$projectId/sessions", params: { projectId: "project-1" } });
    expect(setSessionModalState).not.toHaveBeenCalled();
  });

  it("navigates with G then T sequence", () => {
    const hotkeyManager = createHotkeyManager();
    const sequenceManager = createSequenceManager();
    const navigate = mock(() => {});

    registerShortcutBindings({
      hotkeyManager: hotkeyManager as never,
      sequenceManager: sequenceManager as never,
      projectId: "project-1",
      pathname: "/projects/project-1/settings",
      activeScopes: ["global"],
      isHelpOpen: false,
      requestCreateTicket: () => {},
      setSelectedSessionId: () => {},
      setSessionModalState: () => {},
      setIsHelpOpen: () => {},
      navigate: navigate as never,
      currentTicket: null,
      currentTicketIndex: -1,
      currentWorkspaceIndex: -1,
      visibleTickets: [],
      workspaceShorthand: undefined,
    });

    sequenceManager.handlers.get("G,T")?.handler();

    expect(navigate).toHaveBeenCalledWith({
      to: "/projects/$projectId/tickets",
      params: { projectId: "project-1" },
    });
  });
});

describe("registerShortcutBindings - overlay and sibling navigation", () => {
  it("closes help overlay on Escape when overlay is active", () => {
    const hotkeyManager = createHotkeyManager();
    const sequenceManager = createSequenceManager();
    const setIsHelpOpen = mock(() => {});

    registerShortcutBindings({
      hotkeyManager: hotkeyManager as never,
      sequenceManager: sequenceManager as never,
      projectId: "project-1",
      pathname: "/projects/project-1/tickets",
      activeScopes: ["global"],
      isHelpOpen: true,
      requestCreateTicket: () => {},
      setSelectedSessionId: () => {},
      setSessionModalState: () => {},
      setIsHelpOpen,
      navigate: (() => {}) as never,
      currentTicket: null,
      currentTicketIndex: -1,
      currentWorkspaceIndex: -1,
      visibleTickets: [],
      workspaceShorthand: undefined,
    });

    hotkeyManager.handlers.get("Escape")?.handler({ target: null });

    expect(setIsHelpOpen).toHaveBeenCalledWith(false);
  });

  it("navigates sibling tickets with [ and ]", () => {
    const hotkeyManager = createHotkeyManager();
    const sequenceManager = createSequenceManager();
    const navigate = mock(() => {});

    registerShortcutBindings({
      hotkeyManager: hotkeyManager as never,
      sequenceManager: sequenceManager as never,
      projectId: "project-1",
      pathname: "/projects/project-1/tickets/PS-2",
      activeScopes: ["global", "ticket"],
      isHelpOpen: false,
      requestCreateTicket: () => {},
      setSelectedSessionId: () => {},
      setSessionModalState: () => {},
      setIsHelpOpen: () => {},
      navigate: navigate as never,
      currentTicket: { shorthand: "PS-2", attempts: [] },
      currentTicketIndex: 1,
      currentWorkspaceIndex: -1,
      visibleTickets: [{ shorthand: "PS-1" }, { shorthand: "PS-2" }, { shorthand: "PS-3" }],
      workspaceShorthand: undefined,
    });

    hotkeyManager.handlers.get("[")?.handler({ target: null });
    hotkeyManager.handlers.get("]")?.handler({ target: null });

    expect(navigate).toHaveBeenNthCalledWith(1, {
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId: "project-1", ticketShorthand: "PS-1" },
    });
    expect(navigate).toHaveBeenNthCalledWith(2, {
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId: "project-1", ticketShorthand: "PS-3" },
    });
  });

  it("opens help on Mod+Shift+H and ignores editable targets", () => {
    const hotkeyManager = createHotkeyManager();
    const sequenceManager = createSequenceManager();
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
      hotkeyManager: hotkeyManager as never,
      sequenceManager: sequenceManager as never,
      projectId: "project-1",
      pathname: "/projects/project-1/tickets",
      activeScopes: ["global"],
      isHelpOpen: false,
      requestCreateTicket: () => {},
      setSelectedSessionId: () => {},
      setSessionModalState: () => {},
      setIsHelpOpen,
      navigate: (() => {}) as never,
      currentTicket: null,
      currentTicketIndex: -1,
      currentWorkspaceIndex: -1,
      visibleTickets: [],
      workspaceShorthand: undefined,
    });

    hotkeyManager.handlers
      .get("Mod+Shift+H")
      ?.handler({ target: { tagName: "INPUT", type: "text" } as unknown as EventTarget });
    hotkeyManager.handlers.get("Mod+Shift+H")?.handler({ target: nestedTextNodeInsideEditable });
    hotkeyManager.handlers.get("Mod+Shift+H")?.handler({ target: { tagName: "BUTTON" } as unknown as EventTarget });

    expect(setIsHelpOpen).toHaveBeenCalledTimes(1);
    expect(setIsHelpOpen).toHaveBeenCalledWith(true);
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
