import { getHotkeyManager, getSequenceManager, type Hotkey, type HotkeySequence } from "@tanstack/hotkeys";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import { getVisibleTickets } from "@/features/ticket-list/utils/ticket-visibility";
import { ShortcutHelpPanel } from "./shortcut-help-panel";
import { getActiveShortcutScopes, getShortcutDefinition, isEditableEventTarget } from "./shortcut-registry";

const getHotkeyBinding = (id: Parameters<typeof getShortcutDefinition>[0]) => {
  return getShortcutDefinition(id)!.binding as Hotkey;
};

const getSequenceBinding = (id: Parameters<typeof getShortcutDefinition>[0]) => {
  return getShortcutDefinition(id)!.binding as HotkeySequence;
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
  sequenceManager: ReturnType<typeof getSequenceManager>;
  projectId: string;
  pathname: string;
  activeScopes: string[];
  isHelpOpen: boolean;
  requestCreateTicket: () => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setSessionModalState: (state: "bubble" | "closed" | "attached") => void;
  setIsHelpOpen: (open: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  currentTicket: { shorthand: string; attempts?: Array<{ shorthand: string }> } | null;
  currentTicketIndex: number;
  currentWorkspaceIndex: number;
  visibleTickets: Array<{ shorthand: string; attempts?: Array<{ shorthand: string; updatedAt: string }> }>;
  workspaceShorthand?: string;
}) => {
  const {
    hotkeyManager,
    sequenceManager,
    projectId,
    pathname,
    activeScopes,
    isHelpOpen,
    requestCreateTicket,
    setSelectedSessionId,
    setSessionModalState,
    setIsHelpOpen,
    navigate,
    currentTicket,
    currentTicketIndex,
    currentWorkspaceIndex,
    visibleTickets,
    workspaceShorthand,
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

  const navigateSibling = (direction: -1 | 1) => {
    if (!currentTicket) {
      return;
    }

    if (workspaceShorthand && currentWorkspaceIndex >= 0) {
      const attempts = currentTicket.attempts ?? [];
      const nextWorkspace = attempts[currentWorkspaceIndex + direction];
      if (!nextWorkspace) {
        return;
      }

      navigate({
        to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
        params: { projectId, ticketShorthand: currentTicket.shorthand, workspaceShorthand: nextWorkspace.shorthand },
      });
      return;
    }

    const nextTicket = visibleTickets[currentTicketIndex + direction];
    if (!nextTicket) {
      return;
    }

    navigate({
      to: "/projects/$projectId/tickets/$ticketShorthand",
      params: { projectId, ticketShorthand: nextTicket.shorthand },
    });
  };

  const unregisterHotkeys = [
    hotkeyManager.register(getHotkeyBinding("close-overlay"), () => setIsHelpOpen(false), {
      enabled: isHelpOpen,
      ignoreInputs: false,
    }),
    hotkeyManager.register(getHotkeyBinding("create-ticket"), () => openTicketCreateFlow(), {
      enabled: activeScopes.includes("global"),
      ignoreInputs: true,
    }),
    hotkeyManager.register(getHotkeyBinding("create-session"), () => openSessionCreateFlow(), {
      enabled: activeScopes.includes("global"),
      ignoreInputs: true,
    }),
    hotkeyManager.register(getHotkeyBinding("nav-previous"), () => navigateSibling(-1), {
      enabled: activeScopes.includes("ticket"),
      ignoreInputs: true,
    }),
    hotkeyManager.register(getHotkeyBinding("nav-next"), () => navigateSibling(1), {
      enabled: activeScopes.includes("ticket"),
      ignoreInputs: true,
    }),
    hotkeyManager.register(
      getHotkeyBinding("open-shortcut-help"),
      (event) => {
        if (isEditableEventTarget(event.target)) {
          return;
        }

        setIsHelpOpen(true);
      },
      {
        enabled: activeScopes.includes("global"),
        ignoreInputs: true,
      },
    ),
  ];

  const unregisterSequences = [
    sequenceManager.register(
      getSequenceBinding("goto-ticket-list"),
      () => {
        navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
      },
      { enabled: activeScopes.includes("global"), ignoreInputs: true, timeout: 500 },
    ),
  ];

  return () => {
    unregisterHotkeys.forEach((handle) => {
      handle.unregister();
    });
    unregisterSequences.forEach((handle) => {
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

  const pathname = location.pathname;
  const activeScopes = getActiveShortcutScopes(pathname);
  const shouldLoadTicketShortcuts = shouldLoadTicketsForShortcuts(activeScopes, projectId);
  const { data: tickets } = useProjectTickets(shouldLoadTicketShortcuts ? projectId : undefined);
  const visibleTickets = getVisibleTickets(tickets ?? []);
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
      sequenceManager: getSequenceManager(),
      projectId,
      pathname,
      activeScopes,
      isHelpOpen,
      requestCreateTicket,
      setSelectedSessionId,
      setSessionModalState,
      setIsHelpOpen,
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

  return (
    <ShortcutHelpContext.Provider value={() => setIsHelpOpen(true)}>
      {children}
      <ShortcutHelpPanel open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
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
