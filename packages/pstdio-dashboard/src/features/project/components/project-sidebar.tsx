import { Box, Menu, Portal, Stack } from "@chakra-ui/react";
import {
  MenuItem,
  Sidebar,
  type SidebarNavigateEvent,
  type SidebarNode,
  type SidebarSection,
  toaster,
} from "@pstdio/ui";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, BookOpen, CircleHelp, KanbanSquare, MessageCircle, SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSystemInfo } from "@/features/project/hooks/use-project";
import { ShortcutKbd } from "@/features/shortcuts/shortcut-kbd";
import { useOpenShortcutHelp } from "@/features/shortcuts/shortcut-provider";
import {
  getShortcutDefinition,
  type ShortcutBinding,
  type ShortcutDefinition,
} from "@/features/shortcuts/shortcut-registry";
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
        <MenuItem
          key={action.id}
          onClick={action.onClick}
          isDisabled={action.isDisabled}
          primaryLabel={action.primaryLabel}
          shortcutLabel={action.shortcutLabel}
          leftIcon={action.leftIcon}
        />
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

const resolveActiveNodeId = (pathname: string, projectId?: string) => {
  if (!projectId) return null;

  const base = `/projects/${projectId}`;

  if (pathname.startsWith(`${base}/tickets`)) return "tickets";
  if (pathname.startsWith(`${base}/settings`)) return "settings";
  if (pathname.startsWith(`${base}/sessions`)) return "sessions";

  return null;
};

export const ProjectSidebar = () => {
  const { location } = useRouterState();
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation("projects");

  const buildSections = (): SidebarSection[] => {
    const basePath = projectId ? `/projects/${projectId}` : "";

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

    return [{ id: "top-level", nodes: topNodes }];
  };

  const handleNavigate = (event: SidebarNavigateEvent) => {
    if (!projectId) return;

    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "navigate") {
      const payload = intent.payload as { path: string };
      navigate({ to: `/projects/${projectId}/${payload.path}` });
    }
  };

  const activeNodeId = resolveActiveNodeId(location.pathname, projectId);

  return (
    <Sidebar
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
              <SidebarShortcutMenuItems actions={[...shortcutActions]} />
              <Menu.Separator />
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
              <Menu.Separator />
              <MenuItem
                isDisabled={!systemInfo}
                onClick={handleCopyVersion}
                primaryLabel={t("common:menu.promptStudio")}
                secondaryLabel={versionLabel}
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
