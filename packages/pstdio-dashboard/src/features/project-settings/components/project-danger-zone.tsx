import { Button, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useDeleteProject } from "@/features/project-list/hooks/use-project-list";

interface ProjectDangerZoneProps {
  projectId?: string;
  projectName: string;
}

export const ProjectDangerZone = (props: ProjectDangerZoneProps) => {
  const { projectId, projectName } = props;
  const navigate = useNavigate();
  const deleteProject = useDeleteProject();
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const canDeleteProject = Boolean(projectId) && !deleteProject.isPending;

  const handleOpenDelete = () => {
    if (!projectId) return;
    setDeleteOpen(true);
  };

  const handleCloseDelete = () => {
    setDeleteOpen(false);
  };

  const handleDeleteProject = async () => {
    if (!projectId) {
      throw new Error("Project id is required to delete projects.");
    }

    try {
      await deleteProject.mutateAsync({ projectId });
      toaster.create({
        type: "success",
        title: "Project deleted",
        description: projectName,
      });
      navigate({ to: "/projects" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete project.";
      toaster.create({
        type: "error",
        title: "Delete project failed",
        description: message,
      });
      throw error;
    }
  };

  return (
    <>
      <Stack gap="sm" padding="md" borderWidth="1px" borderRadius="lg" borderColor="red.300" bg="red.50">
        <Stack gap="xs">
          <Text textStyle="label/L/medium" color="red.700">
            Danger zone
          </Text>
          <Text textStyle="paragraph/S/regular" color="red.700">
            Delete this project and all related data. This action cannot be undone.
          </Text>
        </Stack>

        <Button size="sm" variant="outline" colorPalette="red" onClick={handleOpenDelete} disabled={!canDeleteProject}>
          Delete project
        </Button>
      </Stack>

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={handleCloseDelete}
        onDelete={handleDeleteProject}
        headline="Delete project?"
        notificationText="This removes the project and all related data."
        buttonText="Delete project"
      />
    </>
  );
};
