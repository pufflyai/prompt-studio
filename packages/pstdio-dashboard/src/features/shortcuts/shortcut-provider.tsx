import { getHotkeyManager } from "@tanstack/hotkeys";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import type { ShellCore } from "pstdio-shell/core";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { CommandPalette, type CommandPaletteView } from "@/features/command-palette/command-palette";
import { useProjectTickets } from "@/features/ticket-list/hooks/use-project-tickets";
import { getVisibleTickets } from "@/features/ticket-list/utils/ticket-visibility";
import { OpenCommandPaletteContext } from "@/shared/command-palette/open-command-palette-context";
import { useProjectSessions } from "@/shared/sessions/use-project-sessions";
import { getVisibleSessions } from "@/shared/sessions/visible-sessions";
import {
  createDashboardProjectShell,
  DASHBOARD_CLOSE_OVERLAY_COMMAND_ID,
  DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID,
} from "@/shared/shell/dashboard-project-shell";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";
import { registerShellShortcutBindings } from "./shell-shortcut-bindings";
import { buildShortcutHelpEntries } from "./shortcut-help-model";
import { ShortcutHelpPanel } from "./shortcut-help-panel";
import { getActiveShortcutScopes, isEditableEventTarget } from "./shortcut-registry";

const ShortcutHelpContext = createContext<(() => void) | null>(null);

interface ProjectShellState {
  projectId: string;
  shell: ReturnType<typeof createDashboardProjectShell>;
}

const isTicketsRoute = (pathname: string, projectId?: string) => pathname === `/projects/${projectId}/tickets`;

const isSessionsRoute = (pathname: string, projectId?: string) =>
  pathname.startsWith(`/projects/${projectId}/sessions`);

export const shouldLoadTicketsForShortcuts = (activeScopes: string[], projectId?: string) => {
  if (!projectId) return false;

  return activeScopes.includes("global");
};

export const openTicketCreateFlow = (input: {
  projectId: string;
  pathname: string;
  requestCreateTicket: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const { navigate, pathname, projectId, requestCreateTicket } = input;

  requestCreateTicket();
  if (!isTicketsRoute(pathname, projectId)) {
    navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
  }
};

export const openSessionCreateFlow = (input: {
  projectId: string;
  pathname: string;
  setSelectedSessionId: (sessionId: string | null) => void;
  setSessionModalState: (state: "bubble" | "closed" | "attached") => void;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const { navigate, pathname, projectId, setSelectedSessionId, setSessionModalState } = input;

  setSelectedSessionId(null);
  if (isSessionsRoute(pathname, projectId)) {
    navigate({ to: "/projects/$projectId/sessions", params: { projectId } });
    return;
  }

  setSessionModalState("bubble");
};

export const registerShortcutBindings = (input: {
  hotkeyManager: ReturnType<typeof getHotkeyManager>;
  activeScopes: string[];
  isHelpOpen: boolean;
  shell?: ShellCore;
  onShellCommandError?: (error: unknown) => void;
}) => {
  const { activeScopes, hotkeyManager, isHelpOpen, onShellCommandError, shell } = input;
  const unregisterHotkeys = registerShellShortcutBindings({
    hotkeyManager,
    shell,
    activeScopes,
    onError: onShellCommandError,
    shouldHandle: (keybinding, event) => {
      if (keybinding.commandId === DASHBOARD_CLOSE_OVERLAY_COMMAND_ID) {
        return isHelpOpen;
      }

      if (keybinding.commandId === DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID) {
        return !isEditableEventTarget(event.target);
      }

      return true;
    },
  });

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
  const { projectId } = useParams({ strict: false });
  const projectSettingsStore = useProjectSettingsStoreApi();
  const requestCreateTicket = useProjectSettingsStore((state) => state.requestCreateTicket);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteView, setCommandPaletteView] = useState<CommandPaletteView>("main");
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState("");
  const [projectShellState, setProjectShellState] = useState<ProjectShellState | null>(null);

  const pathname = location.pathname;
  const activeScopes = getActiveShortcutScopes(pathname);
  const projectShell =
    projectShellState && projectShellState.projectId === projectId ? projectShellState.shell : undefined;
  const shortcutHelpEntries = buildShortcutHelpEntries(projectShell);
  const shouldLoadTicketShortcuts = shouldLoadTicketsForShortcuts(activeScopes, projectId);
  const { data: tickets } = useProjectTickets(shouldLoadTicketShortcuts ? projectId : undefined);
  const { data: sessions } = useProjectSessions(projectId);
  const visibleTickets = getVisibleTickets(tickets ?? []);
  const visibleSessions = getVisibleSessions(sessions ?? []);

  useEffect(() => {
    if (!projectId) {
      setProjectShellState(null);
      return;
    }

    const projectShell = createDashboardProjectShell({
      projectId,
      navigate: (path) => {
        navigate({ to: path });
      },
      closeOverlay: () => setIsHelpOpen(false),
      requestCreateTicket: () =>
        openTicketCreateFlow({
          projectId,
          pathname,
          requestCreateTicket,
          navigate,
        }),
      requestCreateSession: () =>
        openSessionCreateFlow({
          projectId,
          pathname,
          setSelectedSessionId,
          setSessionModalState,
          navigate,
        }),
      openCommandPalette: () => {
        setCommandPaletteView("main");
        setCommandPaletteInitialQuery("");
        setIsCommandPaletteOpen(true);
      },
      openCommandPaletteCommands: () => {
        setCommandPaletteView("main");
        setCommandPaletteInitialQuery("> ");
        setIsCommandPaletteOpen(true);
      },
      openThemeMenu: () => {
        setCommandPaletteView("theme");
        setCommandPaletteInitialQuery("");
        setIsCommandPaletteOpen(true);
      },
      openShortcutHelp: () => setIsHelpOpen(true),
    });

    setProjectShellState({ projectId, shell: projectShell });

    return () => {
      projectShell.dispose();
    };
  }, [navigate, pathname, projectId, requestCreateTicket, setSelectedSessionId, setSessionModalState]);

  useEffect(() => {
    if (!projectId || activeScopes.length === 0 || !projectShell) {
      return;
    }

    const unregisterShortcuts = registerShortcutBindings({
      hotkeyManager: getHotkeyManager(),
      activeScopes,
      isHelpOpen,
      shell: projectShell,
      onShellCommandError: (error) => {
        console.error(error);
      },
    });

    return () => {
      unregisterShortcuts();
    };
  }, [activeScopes, isHelpOpen, projectId, projectShell]);

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
        {projectId && projectShell ? (
          <CommandPalette
            open={isCommandPaletteOpen}
            initialView={commandPaletteView}
            initialQuery={commandPaletteInitialQuery}
            projectId={projectId}
            tickets={visibleTickets}
            sessions={visibleSessions}
            shell={projectShell}
            requestCreateTicket={requestCreateTicket}
            createSession={createSessionFromPalette}
            openShortcutHelp={() => setIsHelpOpen(true)}
            onClose={() => setIsCommandPaletteOpen(false)}
          />
        ) : null}
        <ShortcutHelpPanel open={isHelpOpen} shortcuts={shortcutHelpEntries} onClose={() => setIsHelpOpen(false)} />
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
