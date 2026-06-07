import type {
  CreateWorkspaceInput as ContractCreateWorkspaceInput,
  ListWorkspaceActivityInput as ContractListWorkspaceActivityInput,
  ListWorkspaceActivityResponse as ContractListWorkspaceActivityResponse,
  RemoveWorktreeResponse as ContractRemoveWorktreeResponse,
  RenameWorkspaceInput as ContractRenameWorkspaceInput,
  UpdateAttemptStatusInput as ContractUpdateAttemptStatusInput,
  UpdateAttemptStatusResponse as ContractUpdateAttemptStatusResponse,
} from "pstdio-api-contracts";

export type CreateWorkspaceInput = ContractCreateWorkspaceInput;
export type ListWorkspaceActivityInput = ContractListWorkspaceActivityInput;
export type ListWorkspaceActivityResponse = ContractListWorkspaceActivityResponse;
export type RemoveWorktreeResponse = ContractRemoveWorktreeResponse;
export type RenameWorkspaceInput = ContractRenameWorkspaceInput;
/** @deprecated Legacy ticket attempt status mutation. Workspace status automation is extension-owned. */
export type UpdateAttemptStatusInput = ContractUpdateAttemptStatusInput;
/** @deprecated Legacy ticket attempt status mutation. Workspace status automation is extension-owned. */
export type UpdateAttemptStatusResponse = ContractUpdateAttemptStatusResponse;
