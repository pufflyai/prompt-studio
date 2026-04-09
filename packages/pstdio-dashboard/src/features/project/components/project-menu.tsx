import { SidebarProjectMenu, useThemePreference } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useProject } from "@/features/project/hooks/use-project";

export const ProjectMenu = () => {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { themePreference, toggleThemePreference } = useThemePreference();
  const { t } = useTranslation();
  const isDarkMode = themePreference === "dark";
  const modeLabel = isDarkMode ? t("menu.switchToLightMode") : t("menu.switchToDarkMode");
  const projectName = project?.name ?? "Project";

  return (
    <SidebarProjectMenu
      name={projectName}
      projectsLabel={t("menu.projects")}
      themeModeLabel={modeLabel}
      isDarkMode={isDarkMode}
      onSelectProjects={() => navigate({ to: "/projects" })}
      onToggleThemePreference={toggleThemePreference}
    />
  );
};
