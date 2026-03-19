import { Avatar, Button, HStack, Menu, Text } from "@chakra-ui/react";
import { MenuItem, toaster, useThemePreference } from "@pstdio/ui";
import { Link, useParams } from "@tanstack/react-router";
import { ChevronDown, FolderIcon, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProject, useSystemInfo } from "@/features/project/hooks/use-project";

const copyVersionToClipboard = async (versionLabel: string, title: string) => {
  await navigator.clipboard.writeText(versionLabel);
  toaster.create({
    type: "success",
    title,
    description: versionLabel,
  });
};

export const ProjectMenu = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: systemInfo } = useSystemInfo();
  const { themePreference, toggleThemePreference } = useThemePreference();
  const { t } = useTranslation();
  const isDarkMode = themePreference === "dark";
  const modeLabel = isDarkMode ? t("menu.switchToLightMode") : t("menu.switchToDarkMode");
  const projectName = project?.name ?? "Project";
  const versionLabel = systemInfo ? `v${systemInfo.version}` : t("menu.loadingVersion");

  const handleCopyVersion = async () => {
    if (!systemInfo) {
      return;
    }

    await copyVersionToClipboard(versionLabel, t("menu.versionCopied"));
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" width="full" justifyContent="flex-start" px="2">
          <HStack gap="2" minW="0" flex="1">
            <Avatar.Root size="2xs">
              <Avatar.Fallback name={projectName} />
            </Avatar.Root>
            <Text textStyle="label/S/medium" truncate>
              {projectName}
            </Text>
          </HStack>
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px" bg="bg">
          <MenuItem asChild primaryLabel={t("menu.projects")} leftIcon={FolderIcon}>
            <Link to="/projects" />
          </MenuItem>
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
