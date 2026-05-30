import type {
  CreateWorkspaceInput as ContractCreateWorkspaceInput,
  ListWorkspaceActivityInput as ContractListWorkspaceActivityInput,
  ListWorkspaceActivityResponse as ContractListWorkspaceActivityResponse,
  RemoveWorktreeResponse as ContractRemoveWorktreeResponse,
  UpdateAttemptStatusInput as ContractUpdateAttemptStatusInput,
  UpdateAttemptStatusResponse as ContractUpdateAttemptStatusResponse,
} from "pstdio-api-contracts";

/** @deprecated Requires legacy ticket-workspace linkage. Ticket ownership is moving to the pstdio tickets extension. */
export type CreateWorkspaceInput = ContractCreateWorkspaceInput;
export type ListWorkspaceActivityInput = ContractListWorkspaceActivityInput;
export type ListWorkspaceActivityResponse = ContractListWorkspaceActivityResponse;
export type RemoveWorktreeResponse = ContractRemoveWorktreeResponse;
/** @deprecated Legacy ticket attempt status mutation. Workspace status automation is extension-owned. */
export type UpdateAttemptStatusInput = ContractUpdateAttemptStatusInput;
/** @deprecated Legacy ticket attempt status mutation. Workspace status automation is extension-owned. */
export type UpdateAttemptStatusResponse = ContractUpdateAttemptStatusResponse;
