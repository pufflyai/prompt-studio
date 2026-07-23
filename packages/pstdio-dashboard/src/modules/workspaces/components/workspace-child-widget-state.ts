export interface WorkspaceFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface WorkspaceFilesState {
  entries: WorkspaceFileEntry[];
  failed: boolean;
  loading: boolean;
}

export const beginWorkspaceFileLoad = (
  workspacePath: string | undefined,
  current: WorkspaceFilesState,
): WorkspaceFilesState => ({
  ...current,
  entries: [],
  failed: false,
  loading: Boolean(workspacePath),
});
