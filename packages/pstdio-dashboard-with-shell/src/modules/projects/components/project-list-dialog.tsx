import { Button, CloseButton, Dialog, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ListRow } from "@pstdio/ui";
import { ShellIcon } from "pstdio-shell/react";
import type { Project } from "../types";

interface ProjectListDialogProps {
  open: boolean;
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  isCreateProjectBlocked: boolean;
  createProjectBlockedMessage: string | null;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
}

export const ProjectListDialog = (props: ProjectListDialogProps) => {
  const {
    open,
    projects,
    selectedProjectId,
    isLoading,
    isCreateProjectBlocked,
    createProjectBlockedMessage,
    onClose,
    onSelectProject,
    onOpenCreateProject,
  } = props;

  return (
    <Dialog.Root lazyMount unmountOnExit open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Stack gap="2xs" flex="1" minW="0">
              <Text textStyle="heading/M">Projects</Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {isLoading ? "Loading projects..." : `${projects.length} projects`}
              </Text>
            </Stack>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="sm">
              {createProjectBlockedMessage ? (
                <Text textStyle="paragraph/S/regular" color="orange.700">
                  {createProjectBlockedMessage}
                </Text>
              ) : null}

              {isLoading ? (
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  Loading projects...
                </Text>
              ) : projects.length === 0 ? (
                <EmptyState title="No projects yet" description="Create a project to start using the dashboard.">
                  <Button size="sm" variant="outline" onClick={onOpenCreateProject} disabled={isCreateProjectBlocked}>
                    Create project
                  </Button>
                </EmptyState>
              ) : (
                <Stack gap="xs">
                  {projects.map((project) => (
                    <ListRow
                      key={project.id}
                      variant="compact"
                      id={project.id}
                      label={project.name}
                      icon={<ShellIcon name="Folder" size={16} />}
                      isSelected={project.id === selectedProjectId}
                      onActivate={() => onSelectProject(project.id)}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
              <Button onClick={onOpenCreateProject} variant="primary" disabled={isCreateProjectBlocked}>
                Create project
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
