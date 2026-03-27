import { Flex, IconButton, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, toaster } from "@pstdio/ui";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { removeProjectRepository } from "@/features/project/data/api";
import type { ProjectRepository } from "@/features/project/types";

interface ProjectRepositoriesPanelProps {
  projectId: string | undefined;
  repositories: ProjectRepository[];
}

export const ProjectRepositoriesPanel = (props: ProjectRepositoriesPanelProps) => {
  const { projectId, repositories } = props;
  const { t } = useTranslation("projects");
  const [removeTarget, setRemoveTarget] = useState<ProjectRepository | null>(null);

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
          <Flex
            key={repo.id}
            alignItems="center"
            gap="md"
            borderWidth="1px"
            borderColor="border.muted"
            borderRadius="md"
            padding="md"
          >
            <Stack flex="1" gap="xs">
              <Text textStyle="paragraph/S/medium">{repo.displayName ?? repo.name}</Text>
              <Text textStyle="paragraph/XS/regular" color="fg.muted">
                {repo.path}
              </Text>
            </Stack>
            {canRemove && (
              <IconButton
                aria-label={t("projectSettings.removeRepository")}
                variant="ghost"
                size="xs"
                onClick={() => setRemoveTarget(repo)}
              >
                <Trash2 size={14} />
              </IconButton>
            )}
          </Flex>
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
