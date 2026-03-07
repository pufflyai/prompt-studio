import { Box, Icon as ChakraIcon, Flex, IconButton, Menu, Stack } from "@chakra-ui/react";
import { MenuItem, Tooltip } from "@pstdio/ui";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  KanbanSquare,
  ListTreeIcon,
  MessageCircle,
  Newspaper,
  SettingsIcon,
} from "lucide-react";
import { ProjectMenu } from "./project-menu";

const projectSections = [
  { id: "docs", label: "Documentation", icon: ListTreeIcon, path: "docs" },
  { id: "tickets", label: "Tickets", icon: KanbanSquare, path: "tickets" },
] as const;

const projectChangelogSection = {
  id: "changelog",
  label: "Project changelog",
  icon: Newspaper,
  path: "changelog",
} as const;

const projectSettingsSection = {
  id: "settings",
  label: "Project settings",
  icon: SettingsIcon,
  path: "settings",
} as const;

const documentationUrl = "https://prompt.studio/docs";
const discordUrl = "https://discord.gg/qH5dAqbNad";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

export const ProjectSidebar = () => {
  const { location } = useRouterState();
  const { projectId } = useParams({ strict: false });

  const projectNavItems = projectId
    ? projectSections.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        to: `/projects/${projectId}/${item.path}`,
      }))
    : [];

  const projectChangelogItem = projectId
    ? {
        id: projectChangelogSection.id,
        label: projectChangelogSection.label,
        icon: projectChangelogSection.icon,
        to: `/projects/${projectId}/${projectChangelogSection.path}`,
      }
    : null;

  const projectSettingsItem = projectId
    ? {
        id: projectSettingsSection.id,
        label: projectSettingsSection.label,
        icon: projectSettingsSection.icon,
        to: `/projects/${projectId}/${projectSettingsSection.path}`,
      }
    : null;

  const isPathActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const handleOpenDocumentation = () => {
    openExternalLink(documentationUrl);
  };

  const handleOpenDiscord = () => {
    openExternalLink(discordUrl);
  };

  return (
    <Flex as="nav" borderRightWidth="1px" hideBelow="md" direction="column">
      <Stack justify="space-between" flex="1" gap="lg" p="xs" align="center">
        <Stack gap="lg" align="center">
          <ProjectMenu />

          <Stack gap="xs" align="center">
            {projectNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isPathActive(item.to);

              return (
                <Tooltip key={item.id} positioning={{ placement: "right" }} content={item.label}>
                  <Flex as="li">
                    <Link to={item.to} preload="intent" style={{ textDecoration: "none" }}>
                      <IconButton
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        variant="ghost"
                        bg={isActive ? "bg.muted" : undefined}
                        size="sm"
                      >
                        <ChakraIcon as={Icon} boxSize="18px" />
                      </IconButton>
                    </Link>
                  </Flex>
                </Tooltip>
              );
            })}
          </Stack>
        </Stack>

        <Stack gap="xs" align="center">
          {projectChangelogItem ? (
            <Tooltip positioning={{ placement: "right" }} content={projectChangelogItem.label}>
              <Flex as="li">
                <Link to={projectChangelogItem.to} preload="intent" style={{ textDecoration: "none" }}>
                  <IconButton
                    aria-label={projectChangelogItem.label}
                    aria-current={isPathActive(projectChangelogItem.to) ? "page" : undefined}
                    variant="ghost"
                    bg={isPathActive(projectChangelogItem.to) ? "bg.muted" : undefined}
                    size="sm"
                  >
                    <ChakraIcon as={projectChangelogItem.icon} boxSize="18px" />
                  </IconButton>
                </Link>
              </Flex>
            </Tooltip>
          ) : null}

          <Menu.Root>
            <Menu.Trigger asChild>
              <Box>
                <Tooltip positioning={{ placement: "right" }} content="Help links">
                  <IconButton aria-label="Help links" variant="ghost" size="sm">
                    <ChakraIcon as={CircleHelp} boxSize="18px" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content minW="220px" bg="bg">
                <MenuItem
                  onClick={handleOpenDocumentation}
                  primaryLabel="Documentation"
                  leftIcon={BookOpen}
                  rightIcon={ArrowUpRight}
                />
                <MenuItem
                  onClick={handleOpenDiscord}
                  primaryLabel="Discord"
                  leftIcon={MessageCircle}
                  rightIcon={ArrowUpRight}
                />
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>

          {projectSettingsItem ? (
            <Tooltip positioning={{ placement: "right" }} content={projectSettingsItem.label}>
              <Flex as="li">
                <Link to={projectSettingsItem.to} preload="intent" style={{ textDecoration: "none" }}>
                  <IconButton
                    aria-label={projectSettingsItem.label}
                    aria-current={isPathActive(projectSettingsItem.to) ? "page" : undefined}
                    variant="ghost"
                    bg={isPathActive(projectSettingsItem.to) ? "bg.muted" : undefined}
                    size="sm"
                  >
                    <ChakraIcon as={projectSettingsItem.icon} boxSize="18px" />
                  </IconButton>
                </Link>
              </Flex>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>
    </Flex>
  );
};
