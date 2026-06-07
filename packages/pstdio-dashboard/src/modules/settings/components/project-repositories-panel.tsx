import { Box, Card, Flex, HStack, Icon, IconButton, Spinner, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { GitBranch, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { removeProjectRepository } from "@/shared/projects/project-api";
import type { ProjectRepository } from "@/shared/projects/project-types";
import { useProject } from "@/shared/projects/use-project";

interface ProjectRepositoriesPanelProps {
  projectId: string | undefined;
}

export const ProjectRepositoriesPanel = (props: ProjectRepositoriesPanelProps) => {
  const { projectId } = props;
  const { t } = useTranslation("projects");
  const { data: project, isLoading } = useProject(projectId);
  const [removeTarget, setRemoveTarget] = useState<ProjectRepository | null>(null);
  const repositories = project?.repositories ?? [];

  const handleRemove = async () => {
    if (!projectId || !removeTarget) return;
    try {
      await removeProjectRepository(projectId, removeTarget.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove repository.";
      toaster.create({ type: "error", title: "Remove failed", description: message });
    } finally {
      setRemoveTarget(null);
    }
  };

  if (isLoading) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner size="sm" />
      </Flex>
    );
  }

  if (repositories.length === 0) {
    return (
      <Stack padding="lg" gap="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("projectSettings.repositoriesEmpty")}
        </Text>
      </Stack>
    );
  }

  const canRemove = repositories.length > 1;

  return (
    <>
      <Stack padding="lg" gap="md">
        {repositories.map((repo) => (
          <Card.Root key={repo.id} size="sm" borderRadius="0" data-testid="project-repository-entry">
            <Card.Body>
              <HStack gap="4" alignItems="flex-start">
                <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
                  <GitBranch />
                </Icon>
                <Box flex="1" minW="0">
                  <Stack gap="1">
                    <Card.Title textStyle="sm">{repo.displayName ?? repo.name}</Card.Title>
                    <Card.Description>{repo.path}</Card.Description>
                  </Stack>
                </Box>
                {canRemove && (
                  <IconButton
                    aria-label={t("projectSettings.removeRepository")}
                    variant="ghost"
                    size="sm"
                    flexShrink="0"
                    onClick={() => setRemoveTarget(repo)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                )}
              </HStack>
            </Card.Body>
          </Card.Root>
        ))}
      </Stack>

      <DeleteConfirmationModal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onDelete={handleRemove}
        headline={t("projectSettings.removeRepositoryConfirm.headline")}
        notificationText={t("projectSettings.removeRepositoryConfirm.notification", {
          name: removeTarget?.displayName ?? removeTarget?.name ?? "",
        })}
        buttonText={t("projectSettings.removeRepositoryConfirm.button")}
      />
    </>
  );
};
