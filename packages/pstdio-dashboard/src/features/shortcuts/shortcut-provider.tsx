import { getHotkeyManager } from "@tanstack/hotkeys";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import type { ShellCore } from "pstdio-shell/core";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
import { useShell } from "@/shared/shell/use-shell";
import { OpenShortcutHelpContext } from "@/shared/shortcut-help/open-shortcut-help-context";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";
import { registerShellShortcutBindings } from "./shell-shortcut-bindings";
import { buildShortcutHelpEntries } from "./shortcut-help-model";
import { ShortcutHelpPanel } from "./shortcut-help-panel";
import { getActiveShortcutScopes, isEditableEventTarget } from "./shortcut-registry";

interface ShortcutProviderContentProps {
  children: ReactNode;
  projectId: string;
}

interface ShortcutShellDeps {
  navigate: ReturnType<typeof useNavigate>;
  pathname: string;
  requestCreateTicket: () => void;
  setCommandPaletteInitialQuery: (query: string) => void;
  setCommandPaletteView: (view: CommandPaletteView) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
  setIsHelpOpen: (open: boolean) => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setSessionModalState: (state: "bubble" | "closed" | "attached") => void;
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

const ShortcutProviderContent = (props: ShortcutProviderContentProps) => {
  const { children } = props;
  const navigate = useNavigate();
  const { location } = useRouterState();
  const { projectId } = props;
  const projectSettingsStore = useProjectSettingsStoreApi();
  const requestCreateTicket = useProjectSettingsStore((state) => state.requestCreateTicket);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteView, setCommandPaletteView] = useState<CommandPaletteView>("main");
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState("");
  const shellDepsRef = useRef<ShortcutShellDeps | null>(null);

  const pathname = location.pathname;
  const activeScopes = getActiveShortcutScopes(pathname);
  shellDepsRef.current = {
    navigate,
    pathname,
    requestCreateTicket,
    setCommandPaletteInitialQuery,
    setCommandPaletteView,
    setIsCommandPaletteOpen,
    setIsHelpOpen,
    setSelectedSessionId,
    setSessionModalState,
  };
  const projectShell = useShell(() =>
    createDashboardProjectShell({
      projectId,
      navigate: (path) => {
        shellDepsRef.current?.navigate({ to: path });
      },
      showProjectNavigationTree: false,
      closeOverlay: () => shellDepsRef.current?.setIsHelpOpen(false),
      requestCreateTicket: () => {
        const deps = shellDepsRef.current;
        if (!deps) return;

        openTicketCreateFlow({
          projectId,
          pathname: deps.pathname,
          requestCreateTicket: deps.requestCreateTicket,
          navigate: deps.navigate,
        });
      },
      requestCreateSession: () => {
        const deps = shellDepsRef.current;
        if (!deps) return;

        openSessionCreateFlow({
          projectId,
          pathname: deps.pathname,
          setSelectedSessionId: deps.setSelectedSessionId,
          setSessionModalState: deps.setSessionModalState,
          navigate: deps.navigate,
        });
      },
      openCommandPalette: () => {
        const deps = shellDepsRef.current;
        if (!deps) return;

        deps.setCommandPaletteView("main");
        deps.setCommandPaletteInitialQuery("");
        deps.setIsCommandPaletteOpen(true);
      },
      openCommandPaletteCommands: () => {
        const deps = shellDepsRef.current;
        if (!deps) return;

        deps.setCommandPaletteView("main");
        deps.setCommandPaletteInitialQuery("> ");
        deps.setIsCommandPaletteOpen(true);
      },
      openThemeMenu: () => {
        const deps = shellDepsRef.current;
        if (!deps) return;

        deps.setCommandPaletteView("theme");
        deps.setCommandPaletteInitialQuery("");
        deps.setIsCommandPaletteOpen(true);
      },
      openShortcutHelp: () => shellDepsRef.current?.setIsHelpOpen(true),
    }),
  );
  const shortcutHelpEntries = buildShortcutHelpEntries(projectShell);
  const shouldLoadTicketShortcuts = shouldLoadTicketsForShortcuts(activeScopes, projectId);
  const { data: tickets } = useProjectTickets(shouldLoadTicketShortcuts ? projectId : undefined);
  const { data: sessions } = useProjectSessions(projectId);
  const visibleTickets = getVisibleTickets(tickets ?? []);
  const visibleSessions = getVisibleSessions(sessions ?? []);

  useEffect(() => {
    if (activeScopes.length === 0) {
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
  }, [activeScopes, isHelpOpen, projectShell]);

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
    <OpenShortcutHelpContext.Provider value={() => setIsHelpOpen(true)}>
      <OpenCommandPaletteContext.Provider
        value={() => {
          setCommandPaletteView("main");
          setCommandPaletteInitialQuery("");
          setIsCommandPaletteOpen(true);
        }}
      >
        {children}
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
        <ShortcutHelpPanel open={isHelpOpen} shortcuts={shortcutHelpEntries} onClose={() => setIsHelpOpen(false)} />
      </OpenCommandPaletteContext.Provider>
    </OpenShortcutHelpContext.Provider>
  );
};

export const ShortcutProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const { projectId } = useParams({ strict: false });

  if (!projectId) return <>{children}</>;

  return (
    <ShortcutProviderContent key={projectId} projectId={projectId}>
      {children}
    </ShortcutProviderContent>
  );
};

export { useOpenCommandPalette } from "@/shared/command-palette/open-command-palette-context";
export { useOpenShortcutHelp } from "@/shared/shortcut-help/open-shortcut-help-context";
