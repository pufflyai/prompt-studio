import { useRouterState } from "@tanstack/react-router";
import type { ShellCore } from "pstdio-shell/core";
import { useEffect } from "react";
import { DASHBOARD_MODE_IDS, type DashboardModeId, type DashboardShell } from "./dashboard-shell";

/**
 * Params are pushed into the shell via context keys rather than mode params:
 * the shell's mode registry has no params bag (see PS-281 / PS-284), and context
 * keys are the established scope mechanism (`when: "projectId"` etc).
 */
export interface RouteActivation {
  modeId: DashboardModeId;
  contextKeys: {
    projectId: string | undefined;
    ticketId: string | undefined;
    sessionId: string | undefined;
  };
}

interface ResolveRouteActivationInput {
  pathname: string;
}

const CONTEXT_KEYS = ["projectId", "ticketId", "sessionId"] as const;

const trimSlashes = (segment: string) => segment.replace(/^\/+|\/+$/g, "");

const splitPath = (pathname: string) => trimSlashes(pathname).split("/").filter(Boolean);

export const resolveRouteActivation = (input: ResolveRouteActivationInput): RouteActivation => {
  const segments = splitPath(input.pathname);
  const empty = { projectId: undefined, ticketId: undefined, sessionId: undefined };

  if (segments[0] === "settings") {
    return { modeId: DASHBOARD_MODE_IDS.dashboardSettings, contextKeys: empty };
  }

  if (segments[0] !== "projects") {
    return { modeId: DASHBOARD_MODE_IDS.projectsList, contextKeys: empty };
  }

  // segments[0] === "projects"
  const projectId = segments[1];
  if (!projectId) {
    return { modeId: DASHBOARD_MODE_IDS.projectsList, contextKeys: empty };
  }

  const subroute = segments[2];

  if (subroute === "sessions") {
    return {
      modeId: DASHBOARD_MODE_IDS.projectSessions,
      contextKeys: { projectId, ticketId: undefined, sessionId: segments[3] },
    };
  }

  if (subroute === "settings") {
    return {
      modeId: DASHBOARD_MODE_IDS.projectSettings,
      contextKeys: { projectId, ticketId: undefined, sessionId: undefined },
    };
  }

  if (subroute === "tickets") {
    if (segments[3] && segments[4] !== "workspaces") {
      return {
        modeId: DASHBOARD_MODE_IDS.projectTicketDetails,
        contextKeys: { projectId, ticketId: segments[3], sessionId: undefined },
      };
    }

    return {
      modeId: DASHBOARD_MODE_IDS.projectNavigation,
      contextKeys: { projectId, ticketId: segments[3], sessionId: undefined },
    };
  }

  // extensions, project index, anything else under the project: project.navigation
  return {
    modeId: DASHBOARD_MODE_IDS.projectNavigation,
    contextKeys: { projectId, ticketId: undefined, sessionId: undefined },
  };
};

export const applyRouteActivation = (shell: ShellCore, activation: RouteActivation) => {
  for (const key of CONTEXT_KEYS) {
    const next = activation.contextKeys[key];
    const current = shell.context.get(key);

    if (next === undefined) {
      if (current !== undefined) shell.context.delete(key);
    } else if (current !== next) {
      shell.context.set(key, next);
    }
  }

  if (shell.modes.getActiveModeId() !== activation.modeId) {
    shell.modes.setActiveMode(activation.modeId);
  }
};

interface TanStackShellAdapterProps {
  shell: DashboardShell;
}

/**
 * Mirrors TanStack route changes into the unified dashboard shell. URL is the
 * source of truth in this chunk (PS-284); the shell-driven URL direction
 * arrives with the first real route migration in a follow-up chunk.
 */
export const TanStackShellAdapter = (props: TanStackShellAdapterProps) => {
  const { shell } = props;
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    applyRouteActivation(shell, resolveRouteActivation({ pathname }));
  }, [shell, pathname]);

  return null;
};
