import {
  type CommandRef,
  type CreateWorkspaceCommandParams,
  type ExtensionContextBase,
  type ExtensionWorkspace,
  l10n,
  type ResourceResolution,
  type TreeAction,
  type TreeNode,
  type TreeViewSection,
} from "@pstdio/sdk/extensions";
import { ticketPageTarget } from "../data/ticket-page-target";
import type { TicketResourceReference } from "../data/ticket-resource-hierarchy";
import { workspacePresentation } from "../data/workspace-presentation";

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
  const { workspaceType, icon } = workspacePresentation(workspace);
  const workspaceMetadata = {
    workspaceId: workspace.id,
    ...(workspace.workspace_shorthand ? { workspaceShorthand: workspace.workspace_shorthand } : {}),
    workspaceType,
    ...ticket,
  };
  const resource = { type: "workspace", extensionId: "pstdio", id: workspace.id, label, metadata: workspaceMetadata };

  return {
    id: `workspace-${workspace.id}`,
    label: workspace.is_default ? l10n("ticketWorkspaces.project", "Project folder") : label,
    icon,
    resource,
  } satisfies TreeNode;
};

const workspaceActivityAt = (workspace: ExtensionWorkspace) => workspace.updated_at ?? workspace.created_at ?? "";

export const createWorkspaceCommand: CommandRef<CreateWorkspaceCommandParams, void> = {
  kind: "command",
  extensionId: "pstdio.pstdio-workspaces",
  id: "show-create",
};

const workspaceSectionActions = (options: CreateWorkspaceCommandParams): TreeAction[] => [
  {
    id: "create-workspace",
    label: l10n("kanbanRenderers.tickets.rowActions.createWorkspace", "Create workspace"),
    icon: "Plus",
    command: createWorkspaceCommand,
    params: options,
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

export const buildWorkspacesSection = async (
  ctx: Pick<ExtensionContextBase, "resources" | "projectId">,
  workspaces: ExtensionWorkspace[],
  ticket: LinkedWorkspaceMetadata,
  creationOptions: CreateWorkspaceCommandParams | undefined,
) => {
  const nodes = workspaceNodes(workspaces, ticket);
  const openings: ResourceResolution[] = [];
  for (let offset = 0; offset < nodes.length; offset += 100) {
    openings.push(
      ...(await ctx.resources.resolveOpenings(
        nodes.slice(offset, offset + 100).map((node) => ({
          ...node.resource,
          projectId: ctx.projectId,
        })),
      )),
    );
  }
  return {
    id: "workspaces",
    label: l10n("navigation.workspaces", "Workspaces"),
    collapsible: true,
    actions: creationOptions ? workspaceSectionActions(creationOptions) : [],
    nodes: nodes.length
      ? nodes.map((node) => {
          const opening = openings.find((entry) => entry.resource.id === node.resource.id);
          const target = opening?.target;
          return {
            ...node,
            target:
              target?.kind === "page"
                ? { ...target, parent: target.parent ?? ticketPageTarget(ticket.resourceParent) }
                : target,
            ...(!target ? { disabled: true } : {}),
          };
        })
      : [emptyWorkspacesNode()],
  } satisfies TreeViewSection;
};
