import { SidebarProjectMenu } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useProject } from "@/features/project/hooks/use-project";
import { useOptionalProjectPickerContext } from "@/features/project-list/components/project-picker-provider";

interface ProjectMenuSelectProjectsOptions {
  projectPicker: { open: () => void } | null;
  navigate: (input: { to: "/projects" }) => unknown;
}

export const handleProjectMenuSelectProjects = (options: ProjectMenuSelectProjectsOptions) => {
  const { projectPicker, navigate } = options;

  if (projectPicker) {
    projectPicker.open();
    return;
  }

  navigate({ to: "/projects" });
};

export const ProjectMenu = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const projectPicker = useOptionalProjectPickerContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const projectName = project?.name ?? "Project";
  const openProjectPicker = () => {
    handleProjectMenuSelectProjects({ projectPicker, navigate });
  };

  return (
    <SidebarProjectMenu name={projectName} projectsLabel={t("menu.projects")} onSelectProjects={openProjectPicker} />
  );
};
