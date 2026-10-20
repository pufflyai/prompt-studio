import type { ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";
import type { TicketContext } from "./ticket-identity";

export const isWorkspaceLinkedToTicket = (workspace: ExtensionWorkspace, ticket: { id: string }) =>
  (workspace.anchors_json ?? []).some((anchor) => anchor.type === "ticket" && anchor.id === ticket.id);

// The ticket reference (id, resolvable to a stored ticket) carried by a session/workspace
// lifecycle payload's resource anchors.
export const ticketRefFromAnchors = (anchors: ResourceAnchor[] | undefined) =>
  anchors?.find((anchor) => anchor.type === "ticket")?.id ?? null;

export const ticketRefFromLifecyclePayload = (payload: {
  anchors?: ResourceAnchor[];
  branch?: string;
  workspace?: { anchors_json?: ResourceAnchor[]; workspace_shorthand?: string } | null;
}) => ticketRefFromAnchors(payload.anchors) ?? ticketRefFromAnchors(payload.workspace?.anchors_json);

// Stable anchors take priority over an old branch name, whose alias may now match
// more than one ticket. Unanchored workspaces resolve their number through core.
export const workspaceTicketIds = async (ctx: TicketContext, workspace: ExtensionWorkspace) => {
  const anchored = (workspace.anchors_json ?? []).filter((anchor) => anchor.type === "ticket").map(({ id }) => id);
  if (anchored.length) return [...new Set(anchored)];
  const name = workspace.branch ?? workspace.workspace_shorthand ?? "";
  const shorthand = /(?:^|\/)([A-Z][A-Z0-9]*-\d+)_A\d+$/.exec(name)?.[1];
  if (!shorthand) return [];
  return (await ctx.resources.findByShorthand({ kind: "ticket", shorthand })).map(({ id }) => id);
};

export const resolveWorkspaceTicketAnchors = async (ctx: TicketContext, workspaces: ExtensionWorkspace[]) =>
  Promise.all(
    workspaces.map(async (workspace) => ({
      ...workspace,
      anchors_json: (await workspaceTicketIds(ctx, workspace)).map((id) => ({ type: "ticket", id })),
    })),
  );
