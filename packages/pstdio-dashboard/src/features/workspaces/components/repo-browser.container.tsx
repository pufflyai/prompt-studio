import { useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProjectRepositories } from "@/features/project/hooks/use-project";
import { useRepoBranches } from "@/features/project/hooks/use-repo-branches";
import type { RepoBranch } from "@/features/project/types";
import { useWorkspaceStore } from "../state";
import { RepoBrowser } from "./repo-browser";

interface RepoBrowserContainerProps {
  isDisabled?: boolean;
}

const getBranchLabel = (branch: RepoBranch, currentBranchTag: string, remoteBranchTag: string) => {
  if (branch.isCurrent) {
    return `${branch.name} (${currentBranchTag})`;
  }

  if (branch.isRemote) {
    return `${branch.name} (${remoteBranchTag})`;
  }

  return branch.name;
};

export const RepoBrowserContainer = (props: RepoBrowserContainerProps) => {
  const { isDisabled = false } = props;
  const { t } = useTranslation("projects");
  const { projectId } = useParams({ strict: false });

  const selectedRepositoryId = useWorkspaceStore((state) => state.selectedRepositoryId);
  const selectedBranch = useWorkspaceStore((state) => state.selectedBranch);
  const setSelectedRepositoryId = useWorkspaceStore((state) => state.setSelectedRepositoryId);
  const setSelectedBranch = useWorkspaceStore((state) => state.setSelectedBranch);
  const { data: repositories = [], isLoading: isRepositoriesPending } = useProjectRepositories(projectId);

  useEffect(() => {
    if (isRepositoriesPending) {
      return;
    }

    if (repositories.length === 0) {
      if (selectedRepositoryId) {
        setSelectedRepositoryId("");
      }
      return;
    }

    const hasSelection = repositories.some((repository) => repository.id === selectedRepositoryId);
    if (!hasSelection) {
      setSelectedRepositoryId(repositories[0].id);
    }
  }, [isRepositoriesPending, repositories, selectedRepositoryId, setSelectedRepositoryId]);

  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    isLoading: isBranchesPending,
  } = useRepoBranches(selectedRepositoryId, {
    enabled: Boolean(selectedRepositoryId),
  });
  const currentBranch = branches.find((branch) => branch.isCurrent)?.name;

  useEffect(() => {
    if (!selectedRepositoryId) {
      if (selectedBranch) {
        setSelectedBranch("");
      }
      return;
    }

    if (isBranchesPending) {
      return;
    }

    if (branches.length === 0) {
      if (selectedBranch) {
        setSelectedBranch("");
      }
      return;
    }

    const hasSelection = branches.some((branch) => branch.name === selectedBranch);
    if (!hasSelection) {
      setSelectedBranch(currentBranch ?? branches[0].name);
    }
  }, [branches, currentBranch, isBranchesPending, selectedBranch, selectedRepositoryId, setSelectedBranch]);

  return (
    <RepoBrowser
      repositoryOptions={repositories.map((repository) => ({
        label: repository.displayName ?? repository.name,
        value: repository.id,
      }))}
      selectedRepository={selectedRepositoryId}
      onSelectRepository={setSelectedRepositoryId}
      branchOptions={branches.map((branch) => ({
        label: getBranchLabel(branch, t("chatInput.branch.tags.current"), t("chatInput.branch.tags.remote")),
        value: branch.name,
      }))}
      selectedBranch={selectedBranch}
      onSelectBranch={setSelectedBranch}
      isDisabled={isDisabled || isLoadingBranches}
    />
  );
};
