import { Box, Icon, Menu, Portal, Stack } from "@chakra-ui/react";
import {
  ListRow,
  Sidebar,
  type TreeListNavigateEvent,
  type TreeListNode,
  type TreeListSection,
  toaster,
} from "@pstdio/ui";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, BookOpen, CircleHelp, KanbanSquare, MessageCircle, Search, SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSystemInfo } from "@/features/project/hooks/use-project";
import { ShortcutKbd } from "@/features/shortcuts/shortcut-kbd";
import { useOpenCommandPalette, useOpenShortcutHelp } from "@/features/shortcuts/shortcut-provider";
import {
  getShortcutDefinition,
  type ShortcutBinding,
  type ShortcutDefinition,
} from "@/features/shortcuts/shortcut-registry";
import { getSlotContributions } from "@/shared/extensions/contribution-mapping";
import { useProjectExtensionMetadata } from "@/shared/extensions/hooks/use-project-extensions";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import { ProjectMenu } from "./project-menu";

export const PROJECT_SIDEBAR_STORAGE_KEY = "project-sidebar";
const GITHUB_DOCS_URL = "https://github.com/pufflyai/prompt-studio";
const DISCORD_URL = "https://discord.gg/3RxwUEk8fW";
export const SIDEBAR_HELP_SHORTCUT_IDS = ["open-shortcut-help"] as const;

export const getSidebarHelpShortcutDefinitions = () => {
  return SIDEBAR_HELP_SHORTCUT_IDS.map((shortcutId) => {
    const definition = getShortcutDefinition(shortcutId);
    if (!definition) {
      throw new Error(`Missing shortcut definition: ${shortcutId}`);
    }

    return definition;
  });
};

export const SidebarShortcutMenuItems = (props: {
  actions: Array<{
    id: ShortcutDefinition["id"];
    primaryLabel: string;
    binding: ShortcutBinding;
    leftIcon: LucideIcon;
    isDisabled?: boolean;
    onClick: () => void;
  }>;
}) => {
  const { actions } = props;
  const menuItems = buildSidebarShortcutMenuItems(actions);

  return (
    <>
      {menuItems.map((action) => (
        <Menu.Item key={action.id} value={action.id} asChild>
          <ListRow
            asChild
            variant="compact"
            id={action.id}
            label={action.primaryLabel}
            icon={<Icon as={action.leftIcon} boxSize="16px" />}
            endContent={action.shortcutLabel}
            disabled={action.isDisabled}
            onActivate={action.onClick}
          />
        </Menu.Item>
      ))}
    </>
  );
};

export const buildSidebarShortcutMenuItems = (
  actions: Array<{
    id: ShortcutDefinition["id"];
    primaryLabel: string;
    binding: ShortcutBinding;
    leftIcon: LucideIcon;
    isDisabled?: boolean;
    onClick: () => void;
  }>,
) => {
  return actions.map((action) => ({
    ...action,
    shortcutLabel: <ShortcutKbd binding={action.binding} />,
  }));
};

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const copyVersionToClipboard = async (versionLabel: string, title: string) => {
  await navigator.clipboard.writeText(versionLabel);
  toaster.create({
    type: "success",
    title,
    description: versionLabel,
  });
};

const resolveActiveNodeId = (
  pathname: string,
  projectId: string | undefined,
  extensionNavigation: DashboardExtensionMetadata["navigation"] = [],
) => {
  if (!projectId) return null;

  const base = `/projects/${projectId}`;

  if (pathname.startsWith(`${base}/tickets`)) return "tickets";
  if (pathname.startsWith(`${base}/settings`)) return "settings";
  if (pathname.startsWith(`${base}/sessions`)) return "sessions";

  const extensionNav = getSlotContributions(extensionNavigation, "project.sidebarNav").find((item) => {
    const href = item.href ?? (item.route ? `${base}/extensions/${item.route}` : null);
    return href ? pathname === href || pathname.startsWith(`${href}/`) : false;
  });

  return extensionNav?.id ?? null;
};

export const buildProjectSidebarSections = (input: {
  projectId?: string;
  searchLabel: string;
  ticketsLabel: string;
  extensionNavigation?: DashboardExtensionMetadata["navigation"];
}): TreeListSection[] => {
  const { projectId, searchLabel, ticketsLabel, extensionNavigation = [] } = input;
  const basePath = projectId ? `/projects/${projectId}` : "";
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
  ];
  const extensionNodes: TreeListNode[] = getSlotContributions(extensionNavigation, "project.sidebarNav").map(
    (item) => ({
      id: item.id,
      label: item.label,
      isNavigable: true,
      href: item.href ?? (item.route ? `${basePath}/extensions/${item.route}` : undefined),
      navigationIntent: item.commandId
        ? { id: "extension-command", payload: { commandId: item.commandId, params: item.params } }
        : item.route
          ? { id: "navigate", payload: { path: `extensions/${item.route}` } }
          : undefined,
    }),
  );

  return [{ id: "top-level", nodes: [...topNodes, ...extensionNodes] }];
};

export const ProjectSidebar = () => {
  const { location } = useRouterState();
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation("projects");
  const { data: extensionMetadata } = useProjectExtensionMetadata(projectId);
  const openCommandPalette = useOpenCommandPalette();
  const sections = buildProjectSidebarSections({
    projectId,
    searchLabel: t("sidebar.search"),
    ticketsLabel: t("sidebar.tickets"),
    extensionNavigation: extensionMetadata?.navigation,
  });

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
      navigate({ to: `/projects/${projectId}/${payload.path}` });
    }
  };

  const activeNodeId = resolveActiveNodeId(location.pathname, projectId, extensionMetadata?.navigation);

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

export const ProjectSidebarFooter = () => {
  const { projectId } = useParams({ strict: false });
  const { location } = useRouterState();
  const { data: systemInfo } = useSystemInfo();
  const { t } = useTranslation(["projects", "common"]);
  const openShortcutHelp = useOpenShortcutHelp();
  const versionLabel = systemInfo ? `v${systemInfo.version}` : t("common:menu.loadingVersion");
  const [helpShortcut] = getSidebarHelpShortcutDefinitions();

  const isPathActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const settingsPath = projectId ? `/projects/${projectId}/settings` : null;
  const sessionsPath = projectId ? `/projects/${projectId}/sessions` : null;

  const handleCopyVersion = async () => {
    if (!systemInfo) {
      return;
    }

    await copyVersionToClipboard(versionLabel, t("common:menu.versionCopied"));
  };

  const shortcutActions = [
    {
      id: helpShortcut.id,
      onClick: openShortcutHelp,
      primaryLabel: helpShortcut.actionLabel,
      binding: helpShortcut.binding,
      leftIcon: CircleHelp,
      isDisabled: false,
    },
  ] as const;

  return (
    <Stack gap="0">
      <Menu.Root positioning={{ placement: "top-start" }}>
        <Menu.Trigger asChild>
          <Box>
            <ListRow
              variant="compact"
              width="full"
              id="help"
              label={t("sidebar.help")}
              icon={<Icon as={CircleHelp} boxSize="16px" />}
            />
          </Box>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="220px" bg="bg">
              <SidebarShortcutMenuItems actions={[...shortcutActions]} />
              <Menu.Separator />
              <Menu.Item value="docs" asChild>
                <ListRow
                  asChild
                  variant="compact"
                  id="docs"
                  label={t("sidebar.documentationLink")}
                  icon={<Icon as={BookOpen} boxSize="16px" />}
                  endContent={<Icon as={ArrowUpRight} boxSize="16px" />}
                  onActivate={() => openExternalLink(GITHUB_DOCS_URL)}
                />
              </Menu.Item>
              <Menu.Item value="discord" asChild>
                <ListRow
                  asChild
                  variant="compact"
                  id="discord"
                  label={t("sidebar.discordLink")}
                  icon={<Icon as={MessageCircle} boxSize="16px" />}
                  endContent={<Icon as={ArrowUpRight} boxSize="16px" />}
                  onActivate={() => openExternalLink(DISCORD_URL)}
                />
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item value="version" asChild>
                <ListRow
                  asChild
                  variant="compact"
                  id="version"
                  label={t("common:menu.promptStudio")}
                  description={versionLabel}
                  disabled={!systemInfo}
                  onActivate={handleCopyVersion}
                />
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {sessionsPath ? (
        <Menu.Root>
          <Menu.Item value="sessions" padding="0" asChild>
            <Link to={sessionsPath}>
              <ListRow
                asChild
                variant="compact"
                width="full"
                id="sessions"
                label={t("projects:sessions.title")}
                icon={<Icon as={MessageCircle} boxSize="16px" />}
                isSelected={isPathActive(sessionsPath)}
              />
            </Link>
          </Menu.Item>
        </Menu.Root>
      ) : null}

      {settingsPath ? (
        <Menu.Root>
          <Menu.Item value="project-settings" padding="0" asChild>
            <Link to={settingsPath}>
              <ListRow
                asChild
                variant="compact"
                width="full"
                id="project-settings"
                label={t("sidebar.projectSettings")}
                icon={<Icon as={SettingsIcon} boxSize="16px" />}
                isSelected={isPathActive(settingsPath)}
              />
            </Link>
          </Menu.Item>
        </Menu.Root>
      ) : null}
    </Stack>
  );
};
