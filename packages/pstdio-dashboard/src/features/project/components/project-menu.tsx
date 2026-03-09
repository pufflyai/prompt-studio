import { Avatar, Box, IconButton, Menu } from "@chakra-ui/react";
import { MenuItem, Tooltip, toaster, useThemePreference } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { FolderIcon, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProject, useSystemInfo } from "@/features/project/hooks/use-project";

const PROJECTS_URL = "/projects";

const copyVersionToClipboard = async (versionLabel: string, title: string) => {
  await navigator.clipboard.writeText(versionLabel);
  toaster.create({
    type: "success",
    title,
    description: versionLabel,
  });
};

export const ProjectMenu = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: systemInfo } = useSystemInfo();
  const { themePreference, toggleThemePreference } = useThemePreference();
  const { t } = useTranslation();
  const isDarkMode = themePreference === "dark";
  const modeLabel = isDarkMode ? t("menu.switchToLightMode") : t("menu.switchToDarkMode");
  const projectName = project?.name ?? "Project";
  const versionLabel = systemInfo ? `v${systemInfo.version}` : t("menu.loadingVersion");

  const handleOpenProjects = () => {
    navigate({ to: PROJECTS_URL });
  };

  const handleCopyVersion = async () => {
    if (!systemInfo) {
      return;
    }

    await copyVersionToClipboard(versionLabel, t("menu.versionCopied"));
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box>
          <Tooltip positioning={{ placement: "bottom-end" }} content={t("menu.mainMenu")}>
            <IconButton
              aria-label={t("menu.openSettingsMenu")}
              variant="ghost"
              size="sm"
              _hover={{ bg: "transparent", boxShadow: "none" }}
              _active={{ bg: "transparent", boxShadow: "none" }}
            >
              <Avatar.Root size="xs" borderRadius="0">
                <Avatar.Fallback name={projectName} />
              </Avatar.Root>
            </IconButton>
          </Tooltip>
        </Box>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px" bg="bg">
          <MenuItem onClick={handleOpenProjects} primaryLabel={t("menu.projects")} leftIcon={FolderIcon} />
          <Menu.Separator />
          <MenuItem onClick={toggleThemePreference} primaryLabel={modeLabel} leftIcon={isDarkMode ? Sun : Moon} />
          <Menu.Separator />
          <MenuItem
            isDisabled={!systemInfo}
            onClick={handleCopyVersion}
            primaryLabel={t("menu.promptStudio")}
            secondaryLabel={versionLabel}
          />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
