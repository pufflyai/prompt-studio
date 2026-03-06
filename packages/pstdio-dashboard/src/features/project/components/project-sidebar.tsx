import { Box, Icon as ChakraIcon, Flex, IconButton, Menu, Stack } from "@chakra-ui/react";
import { MenuItem, Tooltip } from "@pstdio/ui";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  BookOpenText,
  CircleHelp,
  KanbanSquare,
  MessageCircle,
  SettingsIcon,
} from "lucide-react";
import { ProjectMenu } from "./project-menu";

const projectSections = [
  { id: "tickets", label: "Tickets", icon: KanbanSquare, path: "tickets" },
  { id: "docs", label: "Documentation", icon: BookOpenText, path: "docs" },
] as const;

const projectSettingsSection = {
  id: "settings",
  label: "Project settings",
  icon: SettingsIcon,
  path: "settings",
} as const;

const documentationPath = "/docs";

export const ProjectSidebar = () => {
  const { location } = useRouterState();
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const projectNavItems = projectId
    ? projectSections.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        to: `/projects/${projectId}/${item.path}`,
      }))
    : [];
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
    navigate({ to: documentationPath });
  };

  const handleOpenDiscord = () => {
    navigate({ to: documentationPath });
  };

  return (
    <Flex as="nav" borderRightWidth="1px" borderColor="border.subtle" hideBelow="md" direction="column">
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
                        bg={isActive ? "background.secondary" : undefined}
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
              <Menu.Content minW="220px" bg="background.primary">
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
                    bg={isPathActive(projectSettingsItem.to) ? "background.secondary" : undefined}
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
