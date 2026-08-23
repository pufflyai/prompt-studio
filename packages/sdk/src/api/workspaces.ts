import type {
  CreateWorkspaceInput as ContractCreateWorkspaceInput,
  ListWorkspaceActivityInput as ContractListWorkspaceActivityInput,
  ListWorkspaceActivityResponse as ContractListWorkspaceActivityResponse,
  ListWorkspaceFilesInput as ContractListWorkspaceFilesInput,
  MoveWorkspaceEntryInput as ContractMoveWorkspaceEntryInput,
  RemoveWorktreeResponse as ContractRemoveWorktreeResponse,
  RenameWorkspaceInput as ContractRenameWorkspaceInput,
  WorkspaceFileContent as ContractWorkspaceFileContent,
  WorkspaceFileEntry as ContractWorkspaceFileEntry,
  WorkspaceFilesResponse as ContractWorkspaceFilesResponse,
  WriteWorkspaceFileInput as ContractWriteWorkspaceFileInput,
} from "pstdio-api-contracts";

export type CreateWorkspaceInput = ContractCreateWorkspaceInput;
export type ListWorkspaceActivityInput = ContractListWorkspaceActivityInput;
export type ListWorkspaceActivityResponse = ContractListWorkspaceActivityResponse;
export type RemoveWorktreeResponse = ContractRemoveWorktreeResponse;
export type RenameWorkspaceInput = ContractRenameWorkspaceInput;
export type ListWorkspaceFilesInput = ContractListWorkspaceFilesInput;
export type MoveWorkspaceEntryInput = ContractMoveWorkspaceEntryInput;
export type WorkspaceFileContent = ContractWorkspaceFileContent;
export type WorkspaceFileEntry = ContractWorkspaceFileEntry;
export type WorkspaceFilesResponse = ContractWorkspaceFilesResponse;
export type WriteWorkspaceFileInput = ContractWriteWorkspaceFileInput;
