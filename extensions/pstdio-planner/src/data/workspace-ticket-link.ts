import type { ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";

// The ticket shorthand a workspace is linked to, derived from its generic resource
// anchors (a ticket anchor) and falling back to the `<ticket>_A<n>` shorthand convention.
export const ticketShorthandFromWorkspaceShorthand = (workspaceShorthand: string | undefined) => {
  if (!workspaceShorthand) return null;
  const match = /^(.*)_A\d+$/.exec(workspaceShorthand);
  return match?.[1] ?? null;
};

const ticketShorthandFromBranch = (branch: string | undefined) => {
  if (!branch) return null;
  return ticketShorthandFromWorkspaceShorthand(branch.replace(/^workspace\//, ""));
};

const ticketShorthandFromAnchor = (anchor: ResourceAnchor) => {
  const shorthand = anchor.metadata?.shorthand;
  if (typeof shorthand === "string") return shorthand;
  return anchor.label ?? null;
};

export const ticketShorthandFromWorkspace = (workspace: ExtensionWorkspace) => {
  const anchor = workspace.anchors_json?.find((candidate) => candidate.type === "ticket");
  return (
    (anchor ? ticketShorthandFromAnchor(anchor) : null) ??
    ticketShorthandFromWorkspaceShorthand(workspace.workspace_shorthand)
  );
};

export const isWorkspaceLinkedToTicket = (workspace: ExtensionWorkspace, ticketShorthand: string) =>
  ticketShorthandFromWorkspace(workspace) === ticketShorthand;

// The ticket reference (id, resolvable to a stored ticket) carried by a session/workspace
// lifecycle payload's resource anchors.
export const ticketRefFromAnchors = (anchors: ResourceAnchor[] | undefined) =>
  anchors?.find((anchor) => anchor.type === "ticket")?.id ?? null;

export const ticketRefFromLifecyclePayload = (payload: {
  anchors?: ResourceAnchor[];
  branch?: string;
  workspace?: { anchors_json?: ResourceAnchor[]; workspace_shorthand?: string } | null;
}) =>
  ticketRefFromAnchors(payload.workspace?.anchors_json) ??
  ticketRefFromAnchors(payload.anchors) ??
  ticketShorthandFromWorkspaceShorthand(payload.workspace?.workspace_shorthand) ??
  ticketShorthandFromBranch(payload.branch);
