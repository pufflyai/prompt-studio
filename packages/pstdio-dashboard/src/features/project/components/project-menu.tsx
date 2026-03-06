import { Avatar, Box, IconButton, Menu } from "@chakra-ui/react";
import { MenuItem, Tooltip, toaster, useThemePreference } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { FolderIcon, Moon, Sun } from "lucide-react";
import { useProject, useSystemInfo } from "@/features/project/hooks/use-project";

const PROJECTS_URL = "/projects";

const copyVersionToClipboard = async (versionLabel: string) => {
  await navigator.clipboard.writeText(versionLabel);
  toaster.create({
    type: "success",
    title: "Version copied",
    description: versionLabel,
  });
};

export const ProjectMenu = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: systemInfo } = useSystemInfo();
  const { themePreference, toggleThemePreference } = useThemePreference();
  const isDarkMode = themePreference === "dark";
  const modeLabel = isDarkMode ? "Switch to light mode" : "Switch to dark mode";
  const projectName = project?.name ?? "Project";
  const versionLabel = systemInfo ? `v${systemInfo.version}` : "Loading version...";

  const handleOpenProjects = () => {
    navigate({ to: PROJECTS_URL });
  };

  const handleCopyVersion = async () => {
    if (!systemInfo) {
      return;
    }

    await copyVersionToClipboard(versionLabel);
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box>
          <Tooltip positioning={{ placement: "bottom-end" }} content="Main menu">
            <IconButton aria-label="Open settings menu" variant="ghost" size="sm">
              <Avatar.Root size="xs" borderRadius="0">
                <Avatar.Fallback name={projectName} />
              </Avatar.Root>
            </IconButton>
          </Tooltip>
        </Box>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px" bg="background.primary">
          <MenuItem onClick={handleOpenProjects} primaryLabel="Projects" leftIcon={FolderIcon} />
          <Menu.Separator />
          <MenuItem onClick={toggleThemePreference} primaryLabel={modeLabel} leftIcon={isDarkMode ? Sun : Moon} />
          <Menu.Separator />
          <MenuItem
            isDisabled={!systemInfo}
            onClick={handleCopyVersion}
            primaryLabel="Prompt Studio"
            secondaryLabel={versionLabel}
          />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
