import { Flex, Spinner } from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { resolveProjectDefaultPath } from "@/features/project/utils/project-default-path";
import { ProjectPickerModal } from "../components/project-picker-modal";
import { useProjectList } from "../hooks/use-project-list";

export const ProjectListIngress = () => {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjectList();
  const hasProjects = (projects?.length ?? 0) > 0;
  const firstProjectId = projects?.[0]?.id;

  if (isLoading) {
    return (
      <Flex flex="1" align="center" justify="center">
        <Spinner />
      </Flex>
    );
  }

  const handleClose = () => {
    if (firstProjectId) {
      navigate({ to: resolveProjectDefaultPath(firstProjectId), replace: true });
    }
  };

  return <ProjectPickerModal open onClose={handleClose} dismissible={hasProjects} />;
};
