import { SidebarProjectMenu } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useProject } from "@/features/project/hooks/use-project";

export const ProjectMenu = () => {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { t } = useTranslation();
  const projectName = project?.name ?? "Project";

  return (
    <SidebarProjectMenu
      name={projectName}
      projectsLabel={t("menu.projects")}
      onSelectProjects={() => navigate({ to: "/projects" })}
    />
  );
};
