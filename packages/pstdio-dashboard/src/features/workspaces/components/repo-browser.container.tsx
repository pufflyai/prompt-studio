import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectRepositories } from "@/features/project/hooks/use-project";
import { useRepoBranches } from "@/features/project/hooks/use-repo-branches";
import type { RepoBranch } from "@/features/project/types";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { RepoBrowser } from "./repo-browser";

interface RepoBrowserContainerProps {
  isDisabled?: boolean;
  lockedBranch?: string | null;
  onRepoChange?: (repoId: string) => void;
  onBranchChange?: (branch: string) => void;
}

interface ResolveBranchSelectionOptions {
  branches: RepoBranch[];
  selectedBranch: string;
  currentBranch?: string;
  hasUserSelectedBranch: boolean;
}

interface ResolveBranchStateOptions {
  isLocked: boolean;
  isBranchesPending: boolean;
  selectedRepositoryId: string;
  branches: RepoBranch[];
  currentBranch?: string;
  selectedBranch: string;
  hasUserSelectedBranch: boolean;
}

interface BranchState {
  selectedBranch: string;
  hasUserSelectedBranch: boolean;
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

export const resolveBranchSelection = (options: ResolveBranchSelectionOptions) => {
  const { branches, selectedBranch, currentBranch, hasUserSelectedBranch } = options;

  if (branches.length === 0) return "";

  const hasSelection = branches.some((branch) => branch.name === selectedBranch);
  if (hasUserSelectedBranch && hasSelection) {
    return selectedBranch;
  }

  return currentBranch ?? branches[0].name;
};

const resolveBranchState = (options: ResolveBranchStateOptions) => {
  const {
    isLocked,
    isBranchesPending,
    selectedRepositoryId,
    branches,
    currentBranch,
    selectedBranch,
    hasUserSelectedBranch,
  } = options;

  if (isLocked || isBranchesPending) return null;

  if (!selectedRepositoryId || branches.length === 0) {
    return {
      selectedBranch: "",
      hasUserSelectedBranch: false,
    } satisfies BranchState;
  }

  const nextSelectedBranch = resolveBranchSelection({
    branches,
    selectedBranch,
    currentBranch,
    hasUserSelectedBranch,
  });
  const hasSelection = branches.some((branch) => branch.name === selectedBranch);

  return {
    selectedBranch: nextSelectedBranch,
    hasUserSelectedBranch: hasUserSelectedBranch && hasSelection,
  } satisfies BranchState;
};

export const RepoBrowserContainer = (props: RepoBrowserContainerProps) => {
  const { isDisabled = false, lockedBranch, onRepoChange, onBranchChange } = props;
  const { t } = useTranslation("projects");
  const { projectId } = useParams({ strict: false });

  const lastSelectedRepo = useProjectSettingsStore((s) => s.lastSelectedRepo);
  const setLastSelectedRepo = useProjectSettingsStore((s) => s.setLastSelectedRepo);
  const setLastSelectedBranch = useProjectSettingsStore((s) => s.setLastSelectedBranch);

  const [selectedRepositoryId, setSelectedRepositoryId] = useState(lastSelectedRepo);
  const isLocked = Boolean(lockedBranch);
  const [selectedBranch, setSelectedBranch] = useState(lockedBranch ?? "");
  const [hasUserSelectedBranch, setHasUserSelectedBranch] = useState(false);

  const { data: repositories = [], isLoading: isRepositoriesPending } = useProjectRepositories(projectId);

  useEffect(() => {
    if (isRepositoriesPending) return;

    if (repositories.length === 0) {
      if (selectedRepositoryId) {
        setSelectedRepositoryId("");
        onRepoChange?.("");
      }
      return;
    }

    const hasSelection = repositories.some((repository) => repository.id === selectedRepositoryId);
    if (!hasSelection) {
      // Prefer last selected repo if available
      const preferred =
        lastSelectedRepo && repositories.some((r) => r.id === lastSelectedRepo) ? lastSelectedRepo : null;
      const next = preferred ?? repositories[0].id;
      setSelectedRepositoryId(next);
      onRepoChange?.(next);
    }
  }, [isRepositoriesPending, repositories, selectedRepositoryId, lastSelectedRepo, onRepoChange]);

  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    isLoading: isBranchesPending,
  } = useRepoBranches(selectedRepositoryId, {
    enabled: Boolean(selectedRepositoryId),
  });
  const currentBranch = branches.find((branch) => branch.isCurrent)?.name;

  useEffect(() => {
    if (!isLocked || !lockedBranch || selectedBranch === lockedBranch) return;
    setSelectedBranch(lockedBranch);
    onBranchChange?.(lockedBranch);
  }, [isLocked, lockedBranch, selectedBranch, onBranchChange]);

  useEffect(() => {
    const nextState = resolveBranchState({
      isLocked,
      isBranchesPending,
      selectedRepositoryId,
      branches,
      currentBranch,
      selectedBranch,
      hasUserSelectedBranch,
    });
    if (!nextState) return;

    if (nextState.selectedBranch !== selectedBranch) {
      setSelectedBranch(nextState.selectedBranch);
      onBranchChange?.(nextState.selectedBranch);
    }

    if (nextState.hasUserSelectedBranch !== hasUserSelectedBranch) {
      setHasUserSelectedBranch(nextState.hasUserSelectedBranch);
    }
  }, [
    branches,
    currentBranch,
    hasUserSelectedBranch,
    isBranchesPending,
    isLocked,
    selectedBranch,
    selectedRepositoryId,
    onBranchChange,
  ]);

  const handleSelectRepository = (repoId: string) => {
    setSelectedRepositoryId(repoId);
    setHasUserSelectedBranch(false);
    setLastSelectedRepo(repoId);
    onRepoChange?.(repoId);
  };

  const handleSelectBranch = (branch: string) => {
    setHasUserSelectedBranch(true);
    setSelectedBranch(branch);
    setLastSelectedBranch(branch);
    onBranchChange?.(branch);
  };

  return (
    <RepoBrowser
      repositoryOptions={repositories.map((repository) => ({
        label: repository.displayName ?? repository.name,
        value: repository.id,
      }))}
      selectedRepository={selectedRepositoryId}
      onSelectRepository={handleSelectRepository}
      branchOptions={branches.map((branch) => ({
        label: getBranchLabel(branch, t("chatInput.branch.tags.current"), t("chatInput.branch.tags.remote")),
        value: branch.name,
      }))}
      selectedBranch={selectedBranch}
      onSelectBranch={handleSelectBranch}
      isDisabled={isDisabled || isLocked}
      isReposLoading={isRepositoriesPending}
      isBranchesLoading={isLoadingBranches}
    />
  );
};
