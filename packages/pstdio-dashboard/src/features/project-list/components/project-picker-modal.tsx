import { Button, CloseButton, Dialog, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { resolveProjectDefaultPath } from "@/features/project/utils/project-default-path";
import { useProjectPicker } from "../hooks/use-project-picker";
import type { ProjectListItem } from "../types";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectListBanners } from "./project-list-banners";
import { ProjectListRows, ProjectRow } from "./project-list-rows";

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
          <Dialog.Content data-testid="project-picker-modal">
            <Dialog.Header>
              <Flex flex="1" align="center" justify="space-between" gap="sm">
                <Text textStyle="heading/M">{t("list.title")}</Text>
                <Flex align="center" gap="xs">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={picker.openCreate}
                    disabled={picker.availability.isCreateProjectBlocked}
                  >
                    {t("list.createProject")}
                  </Button>
                  {dismissible ? <CloseButton size="sm" onClick={onClose} /> : null}
                </Flex>
              </Flex>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="md">
                <ProjectListBanners
                  showNoAgentsBanner={picker.availability.showNoAgentsBanner}
                  showAgentErrorBanner={picker.availability.showAgentErrorBanner}
                  onRetryAgents={() => void picker.refetchAgents()}
                />
                <Input
                  size="sm"
                  placeholder={t("list.searchPlaceholder")}
                  value={picker.searchTerm}
                  onChange={(event) => picker.setSearchTerm(event.target.value)}
                />
                <ProjectListRows
                  projects={picker.filteredProjects}
                  isLoading={picker.isProjectsLoading}
                  searchTerm={picker.searchTerm}
                  renderRow={(project) => (
                    <button
                      type="button"
                      onClick={() => handleSelectProject(project)}
                      style={{ all: "unset", display: "block", cursor: "pointer", width: "100%" }}
                    >
                      <ProjectRow project={project} />
                    </button>
                  )}
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
