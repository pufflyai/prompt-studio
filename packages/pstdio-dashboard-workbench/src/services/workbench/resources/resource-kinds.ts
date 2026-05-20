import type { ResourceKindContribution, ResourceRef } from "pstdio-workbench/core";

// The dashboard exposes every navigable surface as a typed workbench resource.
// Resource URIs are the canonical identity used by openers, navigation, history,
// and layout persistence — they replace the old `?panel=` / `?tab=` query state.
export const DASHBOARD_URI_SCHEME = "pstdio-dashboard";

export const dashboardResourceKindIds = {
  dashboardView: "dashboard-view",
  ticket: "ticket",
  workspace: "workspace",
  session: "session",
  settingsSection: "settings-section",
  extensionRoute: "extension-route",
} as const;

export const buildResourceUri = (kind: string, id: string) =>
  `${DASHBOARD_URI_SCHEME}://${kind}/${encodeURIComponent(id)}`;

export interface ParsedResourceUri {
  kind: string;
  id: string;
}

export const parseResourceUri = (uri: string): ParsedResourceUri | undefined => {
  const prefix = `${DASHBOARD_URI_SCHEME}://`;
  if (!uri.startsWith(prefix)) return undefined;

  const rest = uri.slice(prefix.length);
  const separator = rest.indexOf("/");
  if (separator <= 0) return undefined;

  const kind = rest.slice(0, separator);
  const id = decodeURIComponent(rest.slice(separator + 1));
  if (!id) return undefined;

  return { kind, id };
};

const dashboardViewMeta = {
  tickets: { label: "Tickets", icon: "Ticket" },
  workspaces: { label: "Workspaces", icon: "GitBranch" },
  sessions: { label: "Sessions", icon: "MessagesSquare" },
} as const;

export type DashboardViewId = keyof typeof dashboardViewMeta;

export const dashboardSettingsSections = [
  { id: "general", label: "General", icon: "Settings" },
  { id: "repositories", label: "Repositories", icon: "FolderGit2" },
  { id: "agents", label: "Agents", icon: "Bot" },
] as const;

export type SettingsSectionId = (typeof dashboardSettingsSections)[number]["id"];

export const dashboardResourceKinds: ResourceKindContribution[] = [
  { kind: dashboardResourceKindIds.dashboardView, label: "Dashboard view", icon: "LayoutDashboard" },
  { kind: dashboardResourceKindIds.ticket, label: "Ticket", icon: "Ticket" },
  { kind: dashboardResourceKindIds.workspace, label: "Workspace", icon: "GitBranch" },
  { kind: dashboardResourceKindIds.session, label: "Session", icon: "MessagesSquare" },
  { kind: dashboardResourceKindIds.settingsSection, label: "Settings", icon: "Settings" },
  { kind: dashboardResourceKindIds.extensionRoute, label: "Extension", icon: "Blocks" },
];

export const dashboardViewResource = (id: DashboardViewId): ResourceRef => ({
  kind: dashboardResourceKindIds.dashboardView,
  uri: buildResourceUri(dashboardResourceKindIds.dashboardView, id),
  id,
  label: dashboardViewMeta[id].label,
  icon: dashboardViewMeta[id].icon,
});

export const ticketResource = (shorthand: string, label?: string): ResourceRef => ({
  kind: dashboardResourceKindIds.ticket,
  uri: buildResourceUri(dashboardResourceKindIds.ticket, shorthand),
  id: shorthand,
  label: label ?? shorthand,
  icon: "Ticket",
});

export const workspaceResource = (shorthand: string, options: { label?: string; tab?: string } = {}): ResourceRef => ({
  kind: dashboardResourceKindIds.workspace,
  uri: buildResourceUri(dashboardResourceKindIds.workspace, shorthand),
  id: shorthand,
  label: options.label ?? shorthand,
  icon: "GitBranch",
  metadata: options.tab ? { tab: options.tab } : undefined,
});

export const sessionResource = (id: string, label?: string): ResourceRef => ({
  kind: dashboardResourceKindIds.session,
  uri: buildResourceUri(dashboardResourceKindIds.session, id),
  id,
  label: label ?? "Session",
  icon: "MessagesSquare",
});

export const settingsSectionResource = (section: string, label?: string): ResourceRef => {
  const known = dashboardSettingsSections.find((entry) => entry.id === section);
  return {
    kind: dashboardResourceKindIds.settingsSection,
    uri: buildResourceUri(dashboardResourceKindIds.settingsSection, section),
    id: section,
    label: label ?? known?.label ?? "Settings",
    icon: known?.icon ?? "Settings",
  };
};

export const extensionRouteResource = (routePath: string, label?: string): ResourceRef => ({
  kind: dashboardResourceKindIds.extensionRoute,
  uri: buildResourceUri(dashboardResourceKindIds.extensionRoute, routePath),
  id: routePath,
  label: label ?? routePath,
  icon: "Blocks",
});
