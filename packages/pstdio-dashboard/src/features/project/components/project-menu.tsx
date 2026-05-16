import { SidebarProjectMenu } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useProject } from "@/features/project/hooks/use-project";
import { useProjectPickerContext } from "@/features/project-list/components/project-picker-provider";

export const ProjectMenu = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { open: openProjectPicker } = useProjectPickerContext();
  const { t } = useTranslation();
  const projectName = project?.name ?? "Project";

  return (
    <SidebarProjectMenu name={projectName} projectsLabel={t("menu.projects")} onSelectProjects={openProjectPicker} />
  );
};
