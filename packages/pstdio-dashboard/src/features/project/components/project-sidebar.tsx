import { Box, Menu, Portal, Stack } from "@chakra-ui/react";
import { MenuItem, type SidebarNavigateEvent, SidebarNext, type SidebarNode, type SidebarSection } from "@pstdio/ui";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  FileText,
  Folder,
  KanbanSquare,
  MessageCircle,
  Newspaper,
  SettingsIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DocsSidebarItem } from "@/features/documentation/data/api";
import { useDocsIndex } from "@/features/documentation/hooks/use-docs";
import { ProjectMenu } from "./project-menu";

export const PROJECT_SIDEBAR_STORAGE_KEY = "project-sidebar";
const GITHUB_DOCS_URL = "https://github.com/pufflyai/prompt-studio";
const DISCORD_URL = "https://discord.gg/3RxwUEk8fW";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const docsSidebarItemToNode = (item: DocsSidebarItem, index: number, projectId?: string): SidebarNode => {
  const id = item.link ?? `doc-folder-${item.text}-${index}`;
  const children = item.items?.map((child, i) => docsSidebarItemToNode(child, i, projectId));
  const hasChildren = children && children.length > 0;
  const href = item.link && projectId ? `/projects/${projectId}/docs?doc=${encodeURIComponent(item.link)}` : undefined;

  return {
    id,
    label: item.text,
    icon: hasChildren ? <Folder size={14} /> : <FileText size={14} />,
    isNavigable: Boolean(item.link),
    href,
    navigationIntent: item.link ? { id: "docs/open", payload: { link: item.link } } : undefined,
    children: hasChildren ? children : undefined,
  };
};

const resolveActiveNodeId = (pathname: string, routeDoc: string | undefined, projectId?: string) => {
  if (!projectId) return null;

  const base = `/projects/${projectId}`;

  if (pathname.startsWith(`${base}/tickets`)) return "tickets";
  if (pathname.startsWith(`${base}/changelog`)) return "changelog";
  if (pathname.startsWith(`${base}/settings`)) return "settings";
  if (pathname.startsWith(`${base}/sessions`)) return "sessions";
  if (pathname.startsWith(`${base}/docs`) && routeDoc) return routeDoc;
  if (pathname.startsWith(`${base}/docs`)) return "docs";

  return null;
};

export const ProjectSidebar = () => {
  const { location } = useRouterState();
  const { projectId } = useParams({ strict: false });
  const routeDoc = (useRouterState().location.search as { doc?: string }).doc;
  const navigate = useNavigate();
  const { t } = useTranslation("projects");
  const { data: docsIndex } = useDocsIndex(projectId);

  const sidebarItems = docsIndex?.sidebar ?? [];
  const hasDocs = sidebarItems.length > 0;

  const buildSections = (): SidebarSection[] => {
    const sections: SidebarSection[] = [];

    const basePath = projectId ? `/projects/${projectId}` : "";

    // Top-level items: tickets
    const topNodes: SidebarNode[] = [
      {
        id: "tickets",
        label: t("sidebar.tickets"),
        icon: <KanbanSquare size={14} />,
        isNavigable: true,
        href: `${basePath}/tickets`,
        navigationIntent: { id: "navigate", payload: { path: "tickets" } },
      },
    ];

    sections.push({ id: "top-level", nodes: topNodes });

    // Documentation group with changelog
    if (hasDocs) {
      const docNodes = sidebarItems.map((item, i) => docsSidebarItemToNode(item, i, projectId));
      const changelogNode: SidebarNode = {
        id: "changelog",
        label: t("sidebar.projectChangelog"),
        icon: <Newspaper size={14} />,
        isNavigable: true,
        href: `${basePath}/changelog`,
        navigationIntent: { id: "navigate", payload: { path: "changelog" } },
      };

      sections.push({
        id: "documentation",
        label: t("sidebar.documentation"),
        nodes: [...docNodes, changelogNode],
      });
    } else {
      // No docs: single documentation item, changelog hidden
      sections.push({
        id: "documentation",
        nodes: [
          {
            id: "docs",
            label: t("sidebar.documentation"),
            icon: <FileText size={14} />,
            isNavigable: true,
            href: `${basePath}/docs`,
            navigationIntent: { id: "navigate", payload: { path: "docs" } },
          },
        ],
      });
    }

    return sections;
  };

  const handleNavigate = (event: SidebarNavigateEvent) => {
    if (!projectId) return;

    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "docs/open") {
      const payload = intent.payload as { link: string };
      navigate({
        to: "/projects/$projectId/docs",
        params: { projectId },
        search: { doc: payload.link },
      });
      return;
    }

    if (intent.id === "navigate") {
      const payload = intent.payload as { path: string };
      navigate({ to: `/projects/${projectId}/${payload.path}` });
    }
  };

  const activeNodeId = resolveActiveNodeId(location.pathname, routeDoc as string | undefined, projectId);

  return (
    <SidebarNext
      storageKey={PROJECT_SIDEBAR_STORAGE_KEY}
      sections={buildSections()}
      activeNodeId={activeNodeId}
      header={<ProjectMenu />}
      footer={<ProjectSidebarFooter />}
      linkComponent={Link}
      onNavigate={handleNavigate}
      width="240px"
    />
  );
};

const ProjectSidebarFooter = () => {
  const { projectId } = useParams({ strict: false });
  const { location } = useRouterState();
  const { t } = useTranslation("projects");

  const isPathActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const settingsPath = projectId ? `/projects/${projectId}/settings` : null;

  return (
    <Stack gap="0">
      <Menu.Root positioning={{ placement: "top-start" }}>
        <Menu.Trigger asChild>
          <Box>
            <MenuItem
              primaryLabel={t("sidebar.help")}
              leftIcon={CircleHelp}
              variant="compact"
              maxWidth="full"
              width="full"
            />
          </Box>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="220px" bg="bg">
              <MenuItem
                onClick={() => openExternalLink(GITHUB_DOCS_URL)}
                primaryLabel={t("sidebar.documentationLink")}
                leftIcon={BookOpen}
                rightIcon={ArrowUpRight}
              />
              <MenuItem
                onClick={() => openExternalLink(DISCORD_URL)}
                primaryLabel={t("sidebar.discordLink")}
                leftIcon={MessageCircle}
                rightIcon={ArrowUpRight}
              />
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {settingsPath ? (
        <Menu.Root>
          <MenuItem
            asChild
            primaryLabel={t("sidebar.projectSettings")}
            leftIcon={SettingsIcon}
            variant="compact"
            isSelected={isPathActive(settingsPath)}
            maxWidth="full"
            width="full"
          >
            <Link to={settingsPath} />
          </MenuItem>
        </Menu.Root>
      ) : null}
    </Stack>
  );
};
