import { Button, Dialog, Stack } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { RepoBrowser } from "@/shared/components/repo-browser";
import type { RepoBranch } from "@/shared/projects/project-types";
import { useProject } from "@/shared/projects/use-project";
import { useRepoBranches } from "@/shared/projects/use-repo-branches";
import { createDashboardWorkspace } from "@/shared/workspaces/workspace-actions";
import {
  resolveCreateWorkspaceBranchSelection,
  resolveCreateWorkspaceRepositorySelection,
} from "./create-workspace-state";

const closeCurrentPlacement = (input: WorkbenchWidgetRenderInput) => {
  input.workbench.layout.removeWidgetPlacement(input.placement.widgetId);
};

const getBranchLabel = (branch: RepoBranch, currentBranchTag: string, remoteBranchTag: string) => {
  if (branch.isCurrent) return `${branch.name} (${currentBranchTag})`;
  if (branch.isRemote) return `${branch.name} (${remoteBranchTag})`;
  return branch.name;
};

export const CreateWorkspaceWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const { t } = useTranslation(["projects", "common"]);
  const projectId = getDashboardSelectedProjectId(input.workbench);
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const [selectedRepository, setSelectedRepository] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const { data: branches = [], isLoading: isBranchesLoading } = useRepoBranches(selectedRepository, {
    enabled: Boolean(selectedRepository),
  });
  const createWorkspaceMutation = useMutation({
    mutationFn: createDashboardWorkspace,
  });
  const repositories = project?.repositories ?? [];
  const repositoryOptions = repositories.map((repository) => ({
    label: repository.displayName ?? repository.name,
    value: repository.id,
  }));
  const branchOptions = branches.map((branch) => ({
    label: getBranchLabel(
      branch,
      t("projects:chatInput.branch.tags.current"),
      t("projects:chatInput.branch.tags.remote"),
    ),
    value: branch.name,
  }));
  const isWorking = createWorkspaceMutation.isPending;
  const canCreate = Boolean(projectId && selectedRepository && selectedBranch && !isWorking);

  if (selectedBranch && !branchOptions.some((option) => option.value === selectedBranch)) {
    branchOptions.push({ label: selectedBranch, value: selectedBranch });
  }

  useEffect(() => {
    const nextRepository = resolveCreateWorkspaceRepositorySelection({
      repositories,
      selectedRepository,
    });

    if (nextRepository !== selectedRepository) {
      setSelectedRepository(nextRepository);
      setSelectedBranch("");
    }
  }, [repositories, selectedRepository]);

  useEffect(() => {
    if (isBranchesLoading) return;

    const nextBranch = resolveCreateWorkspaceBranchSelection({
      branches,
      selectedBranch,
    });

    if (nextBranch !== selectedBranch) setSelectedBranch(nextBranch);
  }, [branches, isBranchesLoading, selectedBranch]);

  const handleSelectRepository = (repository: string) => {
    setSelectedRepository(repository);
    setSelectedBranch("");
  };

  const handleCreateWorkspace = async () => {
    if (!projectId || !selectedRepository || !selectedBranch) return;

    try {
      await createWorkspaceMutation.mutateAsync({
        projectId,
        repoId: selectedRepository,
        base: selectedBranch,
      });
      closeCurrentPlacement(input);
    } catch (error) {
      input.workbench.notifications.show({
        level: "error",
        title: "Failed to create workspace",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <>
      <Dialog.Header py="xs" px="sm">
        <Dialog.Title textStyle="label/S/medium">Create workspace</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body px="sm" py="sm">
        <RepoBrowser
          repositoryOptions={repositoryOptions}
          selectedRepository={selectedRepository}
          onSelectRepository={handleSelectRepository}
          branchOptions={branchOptions}
          selectedBranch={selectedBranch}
          onSelectBranch={setSelectedBranch}
          isDisabled={isWorking}
          isReposLoading={isProjectLoading}
          isBranchesLoading={isBranchesLoading}
          maxListHeight="26rem"
        />
      </Dialog.Body>
      <Dialog.Footer px="sm" py="sm">
        <Stack direction="row" gap="1">
          <Button size="sm" onClick={() => closeCurrentPlacement(input)} variant="outline" disabled={isWorking}>
            {t("common:buttons.cancel")}
          </Button>
          <Button size="sm" onClick={handleCreateWorkspace} loading={isWorking} variant="primary" disabled={!canCreate}>
            Create workspace
          </Button>
        </Stack>
      </Dialog.Footer>
    </>
  );
};
