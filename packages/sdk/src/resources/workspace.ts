import type {
  Workspace as ContractWorkspace,
  WorkspaceListItem as ContractWorkspaceListItem,
} from "pstdio-api-contracts";

export type Workspace = ContractWorkspace;
/** @deprecated Includes legacy ticket-workspace linkage. Ticket ownership is moving to the pstdio tickets extension. */
export type WorkspaceListItem = ContractWorkspaceListItem;
