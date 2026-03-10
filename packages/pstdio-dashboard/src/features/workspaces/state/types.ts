export interface WorkspaceStoreSnapshot {
  selectedRepositoryId: string;
  selectedBranch: string;
}

export interface WorkspaceStoreState extends WorkspaceStoreSnapshot {
  setSelectedRepositoryId: (selectedRepositoryId: string) => void;
  setSelectedBranch: (selectedBranch: string) => void;
  reset: () => void;
}

export type WorkspaceStoreHydration = Partial<WorkspaceStoreSnapshot>;
