import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectRepositories } from "@/features/project/hooks/use-project";
import { useRepoBranches } from "@/features/project/hooks/use-repo-branches";
import type { RepoBranch } from "@/features/project/types";
import { useSessionWorkspace } from "@/features/sessions/hooks/use-session-workspace";
import { useWorkspace } from "@/features/workspaces/hooks/use-workspace";
import { useProjectSettingsStore } from "@/shared/stores/project-settings";
import { RepoBrowser } from "./repo-browser";

interface RepoBrowserContainerProps {
  sessionId?: string | null;
  workspaceId?: string | null;
  isSessionContext?: boolean;
  isDisabled?: boolean;
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
  isSessionContext: boolean;
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
  shouldPersistBranch: boolean;
}

interface ResolveBranchSelectorDisabledStateOptions {
  isSessionContext: boolean;
  isDisabled: boolean;
  isLocked: boolean;
}

interface ResolveLockedBranchOptions {
  sessionWorkspaceBranch?: string | null;
  workspaceBranch?: string | null;
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

export const resolveBranchState = (options: ResolveBranchStateOptions) => {
  const {
    isLocked,
    isSessionContext,
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
      shouldPersistBranch: false,
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
    hasUserSelectedBranch: isSessionContext ? false : hasUserSelectedBranch && hasSelection,
    shouldPersistBranch: !isSessionContext && nextSelectedBranch !== selectedBranch && nextSelectedBranch.length > 0,
  } satisfies BranchState;
};

export const resolveBranchSelectorDisabledState = (options: ResolveBranchSelectorDisabledStateOptions) => {
  const { isDisabled, isSessionContext, isLocked } = options;
  return isDisabled || isSessionContext || isLocked;
};

export const resolveLockedBranch = (options: ResolveLockedBranchOptions) => {
  const { sessionWorkspaceBranch, workspaceBranch } = options;
  return sessionWorkspaceBranch ?? workspaceBranch ?? null;
};

export const RepoBrowserContainer = (props: RepoBrowserContainerProps) => {
  const { sessionId, workspaceId, isSessionContext = false, isDisabled = false, onRepoChange, onBranchChange } = props;
  const { t } = useTranslation("projects");
  const { projectId } = useParams({ strict: false });

  const workspace = useSessionWorkspace(sessionId ?? null);
  const explicitWorkspace = useWorkspace(workspaceId ?? null);
  const lockedBranch = resolveLockedBranch({
    sessionWorkspaceBranch: workspace?.branch ?? null,
    workspaceBranch: explicitWorkspace?.branch ?? null,
  });
  const isLocked = lockedBranch != null;
  const isBranchSelectionDisabled = resolveBranchSelectorDisabledState({
    isSessionContext,
    isDisabled,
    isLocked,
  });

  const lastSelectedRepo = useProjectSettingsStore((s) => s.lastSelectedRepo);
  const setLastSelectedRepo = useProjectSettingsStore((s) => s.setLastSelectedRepo);
  const setLastSelectedBranch = useProjectSettingsStore((s) => s.setLastSelectedBranch);

  const [selectedRepositoryId, setSelectedRepositoryId] = useState(lastSelectedRepo);
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

  // Sync when locked branch changes (workspace loads or switches)
  useEffect(() => {
    if (!isLocked || !lockedBranch || selectedBranch === lockedBranch) return;
    setSelectedBranch(lockedBranch);
    onBranchChange?.(lockedBranch);
  }, [isLocked, lockedBranch, selectedBranch, onBranchChange]);

  useEffect(() => {
    const nextState = resolveBranchState({
      isLocked,
      isSessionContext,
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
      if (nextState.shouldPersistBranch) {
        setLastSelectedBranch(nextState.selectedBranch);
      }
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
    isSessionContext,
    selectedBranch,
    selectedRepositoryId,
    onBranchChange,
    setLastSelectedBranch,
  ]);

  const handleSelectRepository = (repoId: string) => {
    setSelectedRepositoryId(repoId);
    setHasUserSelectedBranch(false);
    setLastSelectedRepo(repoId);
    onRepoChange?.(repoId);
  };

  const handleSelectBranch = (branch: string) => {
    if (isBranchSelectionDisabled) return;

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
      selectedBranch={lockedBranch ?? selectedBranch}
      onSelectBranch={handleSelectBranch}
      isDisabled={isBranchSelectionDisabled}
      isReposLoading={isRepositoriesPending}
      isBranchesLoading={isLoadingBranches}
    />
  );
};
