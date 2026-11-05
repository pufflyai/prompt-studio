import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, SimpleCard, SimpleCardBody, useToaster } from "@pstdio/ui";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getApiClient } from "@/lib/api";
import { useActionError } from "@/shared/components/use-action-error";

interface ProjectDangerZoneProps {
  projectId?: string;
  projectName: string;
  onDeleted?: () => void;
}

export const ProjectDangerZone = (props: ProjectDangerZoneProps) => {
  const toaster = useToaster();
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
      <SimpleCard variant="destructive" data-testid="project-danger-zone-card">
        <SimpleCardBody>
          <HStack gap="md" align="center" justify="space-between" flexWrap="wrap">
            <Stack gap="xs" flex="1">
              <Text textStyle="label/M/medium" color="fg.error">
                Delete project
              </Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                Delete this project and all related data. This action cannot be undone.
              </Text>
            </Stack>
            <Button size="sm" variant="destructive" onClick={handleOpenDelete} disabled={!canDeleteProject}>
              <WorkbenchIcon name="Trash2" size="1em" />
              Delete project
            </Button>
          </HStack>
        </SimpleCardBody>
      </SimpleCard>

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
