import { CloseButton, Dialog, Flex, Stack, Text } from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { resolveProjectDefaultPath } from "@/features/project/utils/project-default-path";
import { useProjectPicker } from "../hooks/use-project-picker";
import type { ProjectListItem } from "../types";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectListBanners } from "./project-list-banners";
import { ProjectSearchableList } from "./project-list-rows";

interface ProjectPickerModalProps {
  open: boolean;
  onClose?: () => void;
  dismissible?: boolean;
}

export const ProjectPickerModal = (props: ProjectPickerModalProps) => {
  const { open, onClose, dismissible = true } = props;
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const picker = useProjectPicker();

  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open && dismissible) onClose?.();
  };

  const handleSelectProject = (project: ProjectListItem) => {
    if (dismissible) onClose?.();
    navigate({ to: resolveProjectDefaultPath(project.id) });
  };

  return (
    <>
      <Dialog.Root
        lazyMount
        unmountOnExit
        open={open}
        onOpenChange={handleOpenChange}
        closeOnInteractOutside={false}
        closeOnEscape={dismissible}
        size="lg"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="640px" data-testid="project-picker-modal">
            <Dialog.Header py="xs" px="sm">
              <Flex alignItems="center" gap="2xs" flex="1">
                <Text textStyle="label/S/medium">{t("list.title")}</Text>
              </Flex>
              {dismissible ? (
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              ) : null}
            </Dialog.Header>
            <Dialog.Body px="sm" py="sm">
              <Stack gap="sm">
                <ProjectListBanners
                  showNoAgentsBanner={picker.availability.showNoAgentsBanner}
                  showAgentErrorBanner={picker.availability.showAgentErrorBanner}
                  onRetryAgents={() => void picker.refetchAgents()}
                />
                <ProjectSearchableList
                  projects={picker.filteredProjects}
                  isLoading={picker.isProjectsLoading}
                  searchTerm={picker.searchTerm}
                  isCreateProjectDisabled={picker.availability.isCreateProjectBlocked}
                  onSearchTermChange={picker.setSearchTerm}
                  onCreateProject={picker.openCreate}
                  onSelectProject={handleSelectProject}
                />
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <CreateProjectDialog
        open={picker.isCreateOpen}
        onClose={picker.closeCreate}
        onCreate={async (input) => {
          const project = await picker.createProject(input);
          if (project && dismissible) onClose?.();
        }}
        availableAgents={picker.availability.availableAgents.map((agent) => ({ id: agent.id, name: agent.name }))}
        isSubmitting={picker.isCreatePending}
      />
    </>
  );
};
