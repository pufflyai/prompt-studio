import type { ResourceRef, TreeNode, TreeViewSection } from "pstdio-shell/core";
import {
  DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID,
  DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID,
} from "./dashboard-project-shortcuts";

export const DASHBOARD_COMMAND_RESOURCE_KIND = "dashboard-command";
export const PROJECT_COMMAND_OPENER_ID = "project.commandOpener";
export const PROJECT_ROUTE_RESOURCE_KIND = "project-route";
export const PROJECT_ROUTE_OPENER_ID = "project.routeOpener";
export const PROJECT_ROUTE_NAVIGATION_PARSER_ID = "dashboard.projectRouteUri";
export const PROJECT_ROUTE_NAVIGATOR_ID = "dashboard.projectRouteRouter";
export const PROJECT_NAVIGATION_MODE_ID = "project.navigation";
export const PROJECT_NAVIGATION_TREE_ID = "project.navigation";
export const PROJECT_NAVIGATION_FOOTER_TREE_ID = "project.navigation.footer";
export const PROJECT_ROUTE_NAVIGATION_PRIORITY = 90;

interface DashboardProjectNavigationInput {
  getExtensionNodes?: () => TreeNode[];
  projectId: string;
  projectName?: string;
}

const normalizeProjectRoutePath = (routePath: string) => routePath.replace(/^\/+|\/+$/g, "");

export const createProjectCommandResource = (
  projectId: string,
  commandId: string,
  label: string,
  icon: string,
): ResourceRef => ({
  kind: DASHBOARD_COMMAND_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/command/${commandId}`,
  id: commandId,
  label,
  icon,
  metadata: { commandId },
});

export const createProjectRouteResource = (
  projectId: string,
  routePath: string,
  label?: string,
  icon?: string,
): ResourceRef => {
  const normalizedRoutePath = normalizeProjectRoutePath(routePath);

  return {
    kind: PROJECT_ROUTE_RESOURCE_KIND,
    uri: `pstdio://project/${projectId}/${normalizedRoutePath}`,
    id: normalizedRoutePath,
    label,
    icon,
    metadata: { projectId, routePath: normalizedRoutePath },
  };
};

export const parseProjectRouteLocation = (location: string) => {
  const match = location.match(/^pstdio:\/\/project\/([^/]+)\/(.+)$/);
  if (!match) return null;

  return {
    projectId: match[1],
    routePath: normalizeProjectRoutePath(match[2]),
  };
};

const parseProjectRouteResource = (resource: ResourceRef) => {
  const metadataProjectId = typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : null;
  const metadataRoutePath = typeof resource.metadata?.routePath === "string" ? resource.metadata.routePath : null;
  if (metadataProjectId && metadataRoutePath) {
    return { projectId: metadataProjectId, routePath: metadataRoutePath };
  }

  return parseProjectRouteLocation(resource.uri);
};

export const createProjectRouteHref = (resource: ResourceRef) => {
  const parsed = parseProjectRouteResource(resource);
  return parsed ? `/projects/${parsed.projectId}/${parsed.routePath}` : "/";
};

export const createProjectNavigationSections = (input: DashboardProjectNavigationInput): TreeViewSection[] => {
  const extensionNodes = input.getExtensionNodes?.() ?? [];

  return [
    {
      id: "project",
      nodes: [
        {
          id: "project:search",
          label: "Search",
          icon: "Search",
          resource: createProjectCommandResource(
            input.projectId,
            DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID,
            "Search",
            "Search",
          ),
        },
        {
          id: "project:tickets",
          label: "Tickets",
          icon: "KanbanSquare",
          resource: createProjectRouteResource(input.projectId, "tickets", "Tickets", "KanbanSquare"),
        },
        ...extensionNodes,
      ],
    },
  ];
};

export const createProjectNavigationFooterSections = (input: DashboardProjectNavigationInput): TreeViewSection[] => [
  {
    id: "project-footer",
    nodes: [
      {
        id: "project:help",
        label: "Help",
        icon: "CircleHelp",
        resource: createProjectCommandResource(
          input.projectId,
          DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID,
          "Help",
          "CircleHelp",
        ),
      },
      {
        id: "project:sessions",
        label: "Sessions",
        icon: "MessageCircle",
        resource: createProjectRouteResource(input.projectId, "sessions", "Sessions", "MessageCircle"),
      },
      {
        id: "project:settings",
        label: "Project settings",
        icon: "Settings",
        resource: createProjectRouteResource(input.projectId, "settings", "Project settings", "Settings"),
      },
    ],
  },
];
