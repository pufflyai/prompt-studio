import type { ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";

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
