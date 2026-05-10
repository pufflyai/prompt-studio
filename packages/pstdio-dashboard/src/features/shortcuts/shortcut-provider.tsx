import { getHotkeyManager, type Hotkey } from "@tanstack/hotkeys";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { CommandPalette, type CommandPaletteView } from "@/features/command-palette/command-palette";
import { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import { getVisibleTickets } from "@/features/ticket-list/utils/ticket-visibility";
import { OpenCommandPaletteContext } from "@/shared/command-palette/open-command-palette-context";
import { useProjectSessions } from "@/shared/sessions/use-project-sessions";
import { getVisibleSessions } from "@/shared/sessions/visible-sessions";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";
import { ShortcutHelpPanel } from "./shortcut-help-panel";
import { getActiveShortcutScopes, getShortcutDefinition, isEditableEventTarget } from "./shortcut-registry";

const getHotkeyBinding = (id: Parameters<typeof getShortcutDefinition>[0]) => {
  return getShortcutDefinition(id)!.binding as Hotkey;
};

const ShortcutHelpContext = createContext<(() => void) | null>(null);

const isTicketsRoute = (pathname: string, projectId?: string) => pathname === `/projects/${projectId}/tickets`;

const isSessionsRoute = (pathname: string, projectId?: string) =>
  pathname.startsWith(`/projects/${projectId}/sessions`);

export const shouldLoadTicketsForShortcuts = (activeScopes: string[], projectId?: string) => {
  if (!projectId) return false;

  return activeScopes.includes("global");
};

export const registerShortcutBindings = (input: {
  hotkeyManager: ReturnType<typeof getHotkeyManager>;
  projectId: string;
  pathname: string;
  activeScopes: string[];
  isHelpOpen: boolean;
  requestCreateTicket: () => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setSessionModalState: (state: "bubble" | "closed" | "attached") => void;
  setIsHelpOpen: (open: boolean) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
  setCommandPaletteView?: (view: CommandPaletteView) => void;
  setCommandPaletteInitialQuery?: (query: string) => void;
  navigate: ReturnType<typeof useNavigate>;
  currentTicket: { shorthand: string; attempts?: Array<{ shorthand: string }> } | null;
  currentTicketIndex: number;
  currentWorkspaceIndex: number;
  visibleTickets: Array<{ shorthand: string; attempts?: Array<{ shorthand: string; updatedAt: string }> }>;
  workspaceShorthand?: string;
}) => {
  const {
    hotkeyManager,
    projectId,
    pathname,
    activeScopes,
    isHelpOpen,
    requestCreateTicket,
    setSelectedSessionId,
    setSessionModalState,
    setIsHelpOpen,
    setIsCommandPaletteOpen,
    setCommandPaletteView,
    setCommandPaletteInitialQuery,
    navigate,
  } = input;

  const openTicketCreateFlow = () => {
    requestCreateTicket();
    if (!isTicketsRoute(pathname, projectId)) {
      navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
    }
  };

  const openSessionCreateFlow = () => {
    setSelectedSessionId(null);
    if (isSessionsRoute(pathname, projectId)) {
      navigate({ to: "/projects/$projectId/sessions", params: { projectId } });
      return;
    }

    setSessionModalState("bubble");
  };

  const unregisterHotkeys = [
    hotkeyManager.register(getHotkeyBinding("close-overlay"), () => setIsHelpOpen(false), {
      enabled: isHelpOpen,
      ignoreInputs: false,
    }),
    hotkeyManager.register(
      getHotkeyBinding("create-ticket"),
      (event) => {
        event.preventDefault?.();
        openTicketCreateFlow();
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: false },
    ),
    hotkeyManager.register(
      getHotkeyBinding("create-session"),
      (event) => {
        event.preventDefault?.();
        openSessionCreateFlow();
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: false },
    ),
    hotkeyManager.register(
      getHotkeyBinding("goto-ticket-list"),
      (event) => {
        event.preventDefault?.();
        navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: false },
    ),
    hotkeyManager.register(
      getHotkeyBinding("open-command-palette"),
      (event) => {
        event.preventDefault?.();
        setCommandPaletteView?.("main");
        setCommandPaletteInitialQuery?.("");
        setIsCommandPaletteOpen(true);
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: false },
    ),
    hotkeyManager.register(
      getHotkeyBinding("open-command-palette-commands"),
      (event) => {
        event.preventDefault?.();
        setCommandPaletteView?.("main");
        setCommandPaletteInitialQuery?.("> ");
        setIsCommandPaletteOpen(true);
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: false },
    ),
    hotkeyManager.register(
      getHotkeyBinding("change-theme"),
      (event) => {
        event.preventDefault?.();
        setCommandPaletteView?.("theme");
        setCommandPaletteInitialQuery?.("");
        setIsCommandPaletteOpen(true);
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: false },
    ),
    hotkeyManager.register(
      getHotkeyBinding("open-shortcut-help"),
      (event) => {
        if (isEditableEventTarget(event.target)) {
          return;
        }

        event.preventDefault?.();
        setIsHelpOpen(true);
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: false },
    ),
  ];

  return () => {
    unregisterHotkeys.forEach((handle) => {
      handle.unregister();
    });
  };
};

export const ShortcutProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const navigate = useNavigate();
  const { location } = useRouterState();
  const { projectId, ticketShorthand, workspaceShorthand } = useParams({ strict: false });
  const projectSettingsStore = useProjectSettingsStoreApi();
  const requestCreateTicket = useProjectSettingsStore((state) => state.requestCreateTicket);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteView, setCommandPaletteView] = useState<CommandPaletteView>("main");
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState("");

  const pathname = location.pathname;
  const activeScopes = getActiveShortcutScopes(pathname);
  const shouldLoadTicketShortcuts = shouldLoadTicketsForShortcuts(activeScopes, projectId);
  const { data: tickets } = useProjectTickets(shouldLoadTicketShortcuts ? projectId : undefined);
  const { data: sessions } = useProjectSessions(projectId);
  const visibleTickets = getVisibleTickets(tickets ?? []);
  const visibleSessions = getVisibleSessions(sessions ?? []);
  const currentTicketIndex = visibleTickets.findIndex((ticket) => ticket.shorthand === ticketShorthand);
  const currentTicket = currentTicketIndex >= 0 ? visibleTickets[currentTicketIndex] : null;
  const currentWorkspaceIndex =
    currentTicket?.attempts?.findIndex((attempt) => attempt.shorthand === workspaceShorthand) ?? -1;

  useEffect(() => {
    if (!projectId || activeScopes.length === 0) {
      return;
    }

    return registerShortcutBindings({
      hotkeyManager: getHotkeyManager(),
      projectId,
      pathname,
      activeScopes,
      isHelpOpen,
      requestCreateTicket,
      setSelectedSessionId,
      setSessionModalState,
      setIsHelpOpen,
      setIsCommandPaletteOpen,
      setCommandPaletteView,
      setCommandPaletteInitialQuery,
      navigate,
      currentTicket,
      currentTicketIndex,
      currentWorkspaceIndex,
      visibleTickets,
      workspaceShorthand,
    });
  }, [
    activeScopes,
    currentTicket,
    currentTicketIndex,
    currentWorkspaceIndex,
    isHelpOpen,
    navigate,
    pathname,
    projectId,
    requestCreateTicket,
    setSelectedSessionId,
    setSessionModalState,
    visibleTickets,
    workspaceShorthand,
  ]);

  useEffect(() => {
    const unsubscribe = projectSettingsStore.subscribe(
      (state) => state.sessionModalState,
      (sessionModalState) => {
        if (sessionModalState !== "closed") {
          return;
        }

        setIsHelpOpen(false);
      },
    );

    return unsubscribe;
  }, [projectSettingsStore]);

  const createSessionFromPalette = () => {
    if (!projectId) return;

    setSelectedSessionId(null);
    if (isSessionsRoute(pathname, projectId)) {
      navigate({ to: "/projects/$projectId/sessions", params: { projectId } });
      return;
    }

    setSessionModalState("bubble");
  };

  return (
    <ShortcutHelpContext.Provider value={() => setIsHelpOpen(true)}>
      <OpenCommandPaletteContext.Provider
        value={() => {
          setCommandPaletteView("main");
          setCommandPaletteInitialQuery("");
          setIsCommandPaletteOpen(true);
        }}
      >
        {children}
        {projectId ? (
          <CommandPalette
            open={isCommandPaletteOpen}
            initialView={commandPaletteView}
            initialQuery={commandPaletteInitialQuery}
            projectId={projectId}
            tickets={visibleTickets}
            sessions={visibleSessions}
            requestCreateTicket={requestCreateTicket}
            createSession={createSessionFromPalette}
            openShortcutHelp={() => setIsHelpOpen(true)}
            onClose={() => setIsCommandPaletteOpen(false)}
          />
        ) : null}
        <ShortcutHelpPanel open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </OpenCommandPaletteContext.Provider>
    </ShortcutHelpContext.Provider>
  );
};

export const useOpenShortcutHelp = () => {
  const openShortcutHelp = useContext(ShortcutHelpContext);
  if (!openShortcutHelp) {
    throw new Error("Shortcut help is unavailable outside ShortcutProvider.");
  }

  return openShortcutHelp;
};

export { useOpenCommandPalette } from "@/shared/command-palette/open-command-palette-context";
