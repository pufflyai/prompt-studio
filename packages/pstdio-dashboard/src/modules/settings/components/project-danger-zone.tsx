import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { ProjectCopyAccount } from "@pstdio/sdk/client";
import { AlertMessage, DeleteConfirmationModal, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { useActionError } from "@/shared/components/use-action-error";
import { CloudProjectDeletionAction } from "../../projects/components/cloud-project-deletion";
import { LocalProjectRemoval } from "../../projects/components/local-project-removal";
import { useLocalProjectDeletion } from "../../projects/data/local-project-deletion";
import { useCloudProjectCatalog } from "../../projects/data/project-catalog";
import { findDashboardProjectRow } from "../../projects/data/project-data";

interface ProjectDangerZoneProps {
  projectId?: string;
  onDeleted?: () => void;
}

const LocalProjectDangerZone = (props: ProjectDangerZoneProps) => {
  const { projectId, onDeleted } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const deletion = useLocalProjectDeletion();
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const canDeleteProject = Boolean(projectId && !deletion.deleting(projectId));

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
      const name = findDashboardProjectRow(projectId)?.name;
      await deletion.remove(projectId, typeof name === "string" ? name : undefined);
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
        confirmDisabled={!canDeleteProject}
        headline="Delete project?"
        notificationText="This removes the project and all related data."
        buttonText="Delete project"
      >
        {errorNotice}
      </DeleteConfirmationModal>
    </>
  );
};

export const ProjectDangerZone = (props: ProjectDangerZoneProps) => {
  const cloud = useCloudProjectCatalog();
  const entry = cloud.data?.projects.find((project) => project.id === props.projectId);
  const deletion = cloud.data?.deletions.find((receipt) => receipt.projectId === props.projectId);
  const account = cloud.data?.account;
  const id = props.projectId;
  const [observed, setObserved] = useState<{ id: string; name: string; account: ProjectCopyAccount }>();
  const [completedScope, setCompletedScope] = useState<string>();
  const scope = JSON.stringify([id, account?.managerOrigin, account?.accountId]);
  useEffect(() => {
    if (id && account && deletion) setObserved({ id, name: deletion.name, account });
  }, [id, account, deletion]);
  const retained =
    observed?.id === id &&
    observed?.account.accountId === account?.accountId &&
    observed?.account.managerOrigin === account?.managerOrigin
      ? observed
      : undefined;
  const project = entry ?? deletion ?? retained;
  if (
    !cloud.accountKnown ||
    cloud.signInRequired ||
    (cloud.signedIn && !project && (!cloud.data || !cloud.membershipKnown))
  )
    return (
      <AlertMessage status="warning" role="status">
        {cloud.error?.message ?? "Connect to Cloud to check this project's copy before deleting it."}
      </AlertMessage>
    );
  if (!id || !project || completedScope === scope)
    return (
      <Stack gap="md">
        {id && completedScope === scope && <Text role="status">Cloud project deleted</Text>}
        <LocalProjectDangerZone {...props} />
      </Stack>
    );

  return (
    <SimpleCard variant="destructive" data-testid="project-danger-zone-card">
      <SimpleCardBody>
        <Stack gap="md">
          {entry?.actions.removeLocal && (
            <HStack gap="md" align="center" justify="space-between" flexWrap="wrap">
              <Stack gap="xs" flex="1">
                <Text textStyle="label/M/medium" color="fg.error">
                  Delete local version
                </Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  Remove downloaded Prompt Studio data from this device. Cloud and other devices keep their copies.
                </Text>
              </Stack>
              <LocalProjectRemoval
                key={scope}
                id={id}
                name={project.name}
                account={cloud.data?.account}
                onRemoved={props.onDeleted}
              />
            </HStack>
          )}
          <HStack gap="md" align="center" justify="space-between" flexWrap="wrap">
            <Stack gap="xs" flex="1">
              <Text textStyle="label/M/medium" color="fg.error">
                Delete cloud project
              </Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                Permanently remove Cloud data and history. Downloaded copies stay as local projects.
              </Text>
              {entry && !entry.online && <Text color="fg.muted">Connect to Cloud to delete this project.</Text>}
            </Stack>
            <CloudProjectDeletionAction
              key={scope}
              id={id}
              name={project.name}
              account={cloud.data?.account}
              canDelete={Boolean(entry?.actions.deleteCloud)}
              receipt={deletion}
              onSubmitted={() => account && setObserved({ id, name: project.name, account })}
              onCompleted={() => setCompletedScope(scope)}
            />
          </HStack>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};
