import type { NavigationParser, NavigationTarget } from "pstdio-workbench/core";
import {
  dashboardViewResource,
  extensionRouteResource,
  sessionResource,
  settingsSectionResource,
  ticketResource,
  workspaceResource,
} from "../resources/resource-kinds";

// Turns dashboard-style deep links into workbench navigation targets. This is the
// single ingress point for routing: the new package never interprets `?panel=` or
// `?tab=` query state directly — the parser folds it into typed resource targets.

const splitLocation = (location: string): { path: string; search: URLSearchParams } => {
  const hashIndex = location.indexOf("#");
  const withoutHash = hashIndex >= 0 ? location.slice(0, hashIndex) : location;
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const search = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");
  return { path, search };
};

const toResourceTarget = (resource: ReturnType<typeof ticketResource>): NavigationTarget => ({
  kind: "resource",
  resource,
});

const parseTicketsArea = (tail: string[], search: URLSearchParams): NavigationTarget => {
  const [shorthand, nested, nestedId] = tail;
  if (!shorthand) return toResourceTarget(dashboardViewResource("tickets"));
  if (nested === "workspaces" && nestedId) {
    return {
      kind: "compound",
      targets: [
        { kind: "resource", resource: ticketResource(shorthand) },
        { kind: "resource", resource: workspaceResource(nestedId, { tab: search.get("tab") ?? undefined }) },
      ],
    };
  }
  return toResourceTarget(ticketResource(shorthand));
};

const parseWorkspacesArea = (tail: string[], search: URLSearchParams): NavigationTarget => {
  const [shorthand] = tail;
  if (!shorthand) return toResourceTarget(dashboardViewResource("workspaces"));
  return toResourceTarget(workspaceResource(shorthand, { tab: search.get("tab") ?? undefined }));
};

const parseSessionsArea = (tail: string[]): NavigationTarget => {
  const [sessionId] = tail;
  if (!sessionId) return toResourceTarget(dashboardViewResource("sessions"));
  return toResourceTarget(sessionResource(sessionId));
};

// Maps a surface segment to its parser. The active project is owned by the
// workbench scope, so navigation only needs the surface-relative segments.
const areaParsers: Record<string, (tail: string[], search: URLSearchParams) => NavigationTarget> = {
  tickets: parseTicketsArea,
  workspaces: parseWorkspacesArea,
  sessions: (tail) => parseSessionsArea(tail),
  settings: (_tail, search) => toResourceTarget(settingsSectionResource(search.get("panel") ?? "general")),
  extensions: (tail) => {
    const routePath = tail.join("/");
    return routePath
      ? toResourceTarget(extensionRouteResource(routePath))
      : toResourceTarget(dashboardViewResource("tickets"));
  },
};

export const parseDashboardLocation = (location: string): NavigationTarget => {
  const { path, search } = splitLocation(location);
  const segments = path.split("/").filter(Boolean);
  const relative = segments[0] === "projects" && segments[1] ? segments.slice(2) : segments;

  const [area, ...tail] = relative;
  const parser = area ? areaParsers[area] : undefined;

  return parser ? parser(tail, search) : toResourceTarget(dashboardViewResource("tickets"));
};

export const createDashboardNavigationParser = (): NavigationParser => ({
  id: "pstdio-dashboard-workbench.location-parser",
  canParse: (location) => location.startsWith("/"),
  parse: parseDashboardLocation,
});
