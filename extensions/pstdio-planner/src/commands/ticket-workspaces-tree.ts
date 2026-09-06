import {
  type ExtensionWorkspace,
  type TreeAction,
  type TreeNode,
  type TreeViewSection,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import { ticketPageTarget } from "../data/ticket-page-target";
import type { TicketResourceReference } from "../data/ticket-resource-hierarchy";
import { createWorkspaceCommand } from "./ticket-actions";

// Prefer the (renamable) workspace name so the sidenav reflects renames; the immutable
// shorthand is only a fallback. The tree re-runs on workspace collection changes, so the
// label updates as soon as a rename streams back.
const workspaceLabel = (workspace: ExtensionWorkspace) =>
  workspace.name ?? workspace.workspace_shorthand ?? workspace.id;

// Canonical edge from a linked workspace to the ticket resource that owns it.
type LinkedWorkspaceMetadata = {
  resourceParent: TicketResourceReference;
};

const workspaceNode = (workspace: ExtensionWorkspace, ticket: LinkedWorkspaceMetadata) => {
  const label = workspaceLabel(workspace);
  const workspaceMetadata = {
    workspaceId: workspace.id,
    ...(workspace.workspace_shorthand ? { workspaceShorthand: workspace.workspace_shorthand } : {}),
    workspaceType: workspace.worktree_path ? "worktree" : "current_branch",
    ...ticket,
  };
  const resource = { type: "workspace", id: workspace.id, label, metadata: workspaceMetadata };

  return {
    id: `workspace-${workspace.id}`,
    label,
    icon: "GitBranch",
    resource,
    target: {
      kind: "page",
      page: workbenchPages.workspace,
      resource,
      parent: ticketPageTarget(ticket.resourceParent),
    },
  } satisfies TreeNode;
};

const workspaceActivityAt = (workspace: ExtensionWorkspace) => workspace.updated_at ?? workspace.created_at ?? "";

const createWorkspaceTreeActionParams = {
  repo: createWorkspaceCommand.params!.repo,
  mode: createWorkspaceCommand.params!.mode,
};

const workspaceSectionActions = (ticketId: string): TreeAction[] => [
  {
    id: "create-workspace",
    label: "Create workspace",
    icon: "Plus",
    command: createWorkspaceCommand.ref,
    params: { ticket: ticketId },
    input: createWorkspaceTreeActionParams,
  },
];

const workspaceNodes = (workspaces: ExtensionWorkspace[], ticket: LinkedWorkspaceMetadata) =>
  [...workspaces]
    .sort((a, b) => {
      const activityOrder = workspaceActivityAt(b).localeCompare(workspaceActivityAt(a));
      return activityOrder !== 0 ? activityOrder : workspaceLabel(a).localeCompare(workspaceLabel(b));
    })
    .map((workspace) => workspaceNode(workspace, ticket));

const emptyWorkspacesNode = (): TreeNode => ({
  id: "workspaces-empty",
  label: "No workspaces",
  icon: "GitBranch",
  disabled: true,
  rowVariant: "empty-state",
});

export const buildWorkspacesSection = (
  workspaces: ExtensionWorkspace[],
  ticketId: string,
  ticket: LinkedWorkspaceMetadata,
) =>
  ({
    id: "workspaces",
    label: "Workspaces",
    collapsible: true,
    actions: workspaceSectionActions(ticketId),
    nodes: workspaces.length > 0 ? workspaceNodes(workspaces, ticket) : [emptyWorkspacesNode()],
  }) satisfies TreeViewSection;
