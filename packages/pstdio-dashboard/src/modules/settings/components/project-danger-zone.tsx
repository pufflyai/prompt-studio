import { Box, Button, Card, HStack, Icon, Stack } from "@chakra-ui/react";
import { DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { useMutation } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { getApiClient } from "@/lib/api";
import { useActionError } from "@/shared/components/use-action-error";

interface ProjectDangerZoneProps {
  projectId?: string;
  projectName: string;
  onDeleted?: () => void;
}

export const ProjectDangerZone = (props: ProjectDangerZoneProps) => {
  const { projectId, projectName, onDeleted } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const deleteProject = useMutation({
    mutationFn: async (input: { projectId: string }) => {
      await getApiClient().projects.delete(input.projectId);
    },
  });
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const canDeleteProject = Boolean(projectId) && !deleteProject.isPending;

  const handleOpenDelete = () => {
    if (!projectId) return;
    clearError();
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
      setDeleteOpen(false);
      onDeleted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete project.";
      showError({
        title: "Delete project failed",
        description: message,
      });
      throw error;
    }
  };

  return (
    <>
      <Stack padding="lg">
        <Card.Root size="sm" borderRadius="0" borderColor="red.300" data-testid="project-danger-zone-card">
          <Card.Body>
            <HStack gap="4" alignItems="flex-start">
              <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="red.600">
                <TriangleAlert />
              </Icon>
              <Box flex="1" minW="0">
                <Stack gap="1">
                  <Card.Title textStyle="sm" color="red.700">
                    Danger zone
                  </Card.Title>
                  <Card.Description color="red.700">
                    Delete this project and all related data. This action cannot be undone.
                  </Card.Description>
                </Stack>
              </Box>
              <Button
                size="sm"
                variant="outline"
                colorPalette="red"
                flexShrink="0"
                onClick={handleOpenDelete}
                disabled={!canDeleteProject}
              >
                Delete project
              </Button>
            </HStack>
          </Card.Body>
        </Card.Root>
      </Stack>

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={handleCloseDelete}
        onDelete={handleDeleteProject}
        headline="Delete project?"
        notificationText="This removes the project and all related data."
        buttonText="Delete project"
      >
        {errorNotice}
      </DeleteConfirmationModal>
    </>
  );
};
