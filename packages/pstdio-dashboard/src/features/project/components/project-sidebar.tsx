import { Sidebar, type TreeListNavigateEvent, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { FlaskConical, KanbanSquare, Puzzle, Search } from "lucide-react";
import type { ExtensionNavigationRecord } from "pstdio-api-contracts";
import { useTranslation } from "react-i18next";
import { buildSlotInvocation, getExtensionNavigationForSlot } from "@/features/extensions/extension-slots";
import { useExecuteExtensionCommand, useExtensionsCheck } from "@/features/extensions/hooks/use-extensions-check";
import { useOpenCommandPalette } from "@/features/shortcuts/shortcut-provider";
import { ProjectMenu } from "./project-menu";
import {
  buildSidebarShortcutMenuItems,
  getSidebarHelpShortcutDefinitions,
  ProjectSidebarFooter,
  SIDEBAR_HELP_SHORTCUT_IDS,
} from "./project-sidebar-footer";

export const PROJECT_SIDEBAR_STORAGE_KEY = "project-sidebar";
const PROJECT_SIDEBAR_NAV_SLOT = "project.sidebarNav";

export {
  buildSidebarShortcutMenuItems,
  getSidebarHelpShortcutDefinitions,
  ProjectSidebarFooter,
  SIDEBAR_HELP_SHORTCUT_IDS,
};

const EXTENSION_NAV_ICONS: Record<string, LucideIcon> = {
  "flask-conical": FlaskConical,
};

const resolveExtensionNavIcon = (icon: string | undefined) => EXTENSION_NAV_ICONS[icon ?? ""] ?? Puzzle;

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const normalizeRoutePath = (path: string) => path.replace(/^\/+|\/+$/gu, "");

export const resolveActiveNodeId = (
  pathname: string,
  projectId?: string,
  extensionNavigation: ExtensionNavigationRecord[] = [],
) => {
  if (!projectId) return null;

  const base = `/projects/${projectId}`;

  if (pathname.startsWith(`${base}/tickets`)) return "tickets";
  if (pathname.startsWith(`${base}/settings`)) return "settings";
  if (pathname.startsWith(`${base}/sessions`)) return "sessions";

  const extensionRoute = extensionNavigation.find((item) => {
    if (!item.route) return false;
    return pathname === `${base}/${normalizeRoutePath(item.route)}`;
  });

  if (extensionRoute) return `extension:${extensionRoute.id}`;

  return null;
};

export const buildProjectSidebarSections = (input: {
  projectId?: string;
  searchLabel: string;
  ticketsLabel: string;
  extensionNavigation?: ExtensionNavigationRecord[];
}): TreeListSection[] => {
  const { projectId, searchLabel, ticketsLabel, extensionNavigation } = input;
  const basePath = projectId ? `/projects/${projectId}` : "";
  const extensionNodes: TreeListNode[] = getExtensionNavigationForSlot(
    extensionNavigation,
    PROJECT_SIDEBAR_NAV_SLOT,
  ).map((item) => {
    const IconComponent = resolveExtensionNavIcon(item.icon);
    const path = item.route ? `${basePath}/${item.route}` : undefined;

    return {
      id: `extension:${item.id}`,
      label: item.label,
      icon: <IconComponent size={14} />,
      isNavigable: true,
      href: item.href ?? path,
      navigationIntent: { id: "extension-navigation", payload: { id: item.id } },
    };
  });
  const topNodes: TreeListNode[] = [
    {
      id: "search",
      label: searchLabel,
      icon: <Search size={14} />,
      isNavigable: true,
      navigationIntent: { id: "command-palette" },
    },
    {
      id: "tickets",
      label: ticketsLabel,
      icon: <KanbanSquare size={14} />,
      isNavigable: true,
      href: `${basePath}/tickets`,
      navigationIntent: { id: "navigate", payload: { path: "tickets" } },
    },
    ...extensionNodes,
  ];

  return [{ id: "top-level", nodes: topNodes }];
};

export const ProjectSidebar = () => {
  const { location } = useRouterState();
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation("projects");
  const openCommandPalette = useOpenCommandPalette();
  const extensionsCheck = useExtensionsCheck();
  const executeExtensionCommand = useExecuteExtensionCommand();
  const extensionNavigation = getExtensionNavigationForSlot(extensionsCheck.data?.navigation, PROJECT_SIDEBAR_NAV_SLOT);
  const sections = buildProjectSidebarSections({
    projectId,
    searchLabel: t("sidebar.search"),
    ticketsLabel: t("sidebar.tickets"),
    extensionNavigation,
  });

  const navigateToProjectPath = (currentProjectId: string, path: string) => {
    navigate({ to: `/projects/${currentProjectId}/${path}` });
  };

  const executeNavigationCommand = (currentProjectId: string, item: ExtensionNavigationRecord) => {
    if (!item.commandId) return;

    executeExtensionCommand.mutate([
      item.commandId,
      {
        projectId: currentProjectId,
        params: item.params,
        slot: buildSlotInvocation(PROJECT_SIDEBAR_NAV_SLOT, "navigation", { projectId: currentProjectId }),
        source: "dashboard",
      },
    ]);
  };

  const handleExtensionNavigation = (currentProjectId: string, item: ExtensionNavigationRecord | undefined) => {
    if (!item) return;

    if (item.href) {
      openExternalLink(item.href);
      return;
    }

    if (item.route) {
      navigateToProjectPath(currentProjectId, item.route);
      return;
    }

    executeNavigationCommand(currentProjectId, item);
  };

  const handleNavigate = (event: TreeListNavigateEvent) => {
    if (!projectId) return;

    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "command-palette") {
      openCommandPalette();
      return;
    }

    if (intent.id === "navigate") {
      const payload = intent.payload as { path: string };
      navigateToProjectPath(projectId, payload.path);
      return;
    }

    if (intent.id === "extension-navigation") {
      const payload = intent.payload as { id: string };
      handleExtensionNavigation(
        projectId,
        extensionNavigation.find((nav) => nav.id === payload.id),
      );
    }
  };

  const activeNodeId = resolveActiveNodeId(location.pathname, projectId, extensionNavigation);

  return (
    <Sidebar
      storageKey={PROJECT_SIDEBAR_STORAGE_KEY}
      sections={sections}
      activeNodeId={activeNodeId}
      header={<ProjectMenu />}
      footer={<ProjectSidebarFooter />}
      linkComponent={Link}
      onNavigate={handleNavigate}
      width="240px"
    />
  );
};
