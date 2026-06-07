interface WorkspaceRepositoryOption {
  id: string;
}

interface WorkspaceBranchOption {
  name: string;
  isCurrent: boolean;
}

export const resolveCreateWorkspaceRepositorySelection = (input: {
  repositories: WorkspaceRepositoryOption[];
  selectedRepository: string;
}) => {
  if (input.repositories.some((repository) => repository.id === input.selectedRepository)) {
    return input.selectedRepository;
  }

  return input.repositories[0]?.id ?? "";
};

export const resolveCreateWorkspaceBranchSelection = (input: {
  branches: WorkspaceBranchOption[];
  selectedBranch: string;
}) => {
  if (input.branches.some((branch) => branch.name === input.selectedBranch)) return input.selectedBranch;
  return input.branches.find((branch) => branch.isCurrent)?.name ?? input.branches[0]?.name ?? "";
};
