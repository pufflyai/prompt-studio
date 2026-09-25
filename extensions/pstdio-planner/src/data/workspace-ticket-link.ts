import type { ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";

const ticketShorthandFromAnchor = (anchor: ResourceAnchor) => {
  if (typeof anchor.shorthand === "string") return anchor.shorthand;
  // Anchors stored before the shorthand moved to the top level still carry it in
  // metadata, and their label is the display title rather than the shorthand.
  const stored = (anchor.metadata as { shorthand?: unknown } | undefined)?.shorthand;
  if (typeof stored === "string") return stored;
  return anchor.label ?? null;
};

export const ticketShorthandsFromWorkspace = (workspace: ExtensionWorkspace) => [
  ...new Set(
    (workspace.anchors_json ?? [])
      .filter((anchor) => anchor.type === "ticket")
      .map(ticketShorthandFromAnchor)
      .filter((shorthand): shorthand is string => shorthand !== null),
  ),
];

export const isWorkspaceLinkedToTicket = (workspace: ExtensionWorkspace, ticketShorthand: string) =>
  ticketShorthandsFromWorkspace(workspace).includes(ticketShorthand);

// The ticket reference (id, resolvable to a stored ticket) carried by a session/workspace
// lifecycle payload's resource anchors.
export const ticketRefFromAnchors = (anchors: ResourceAnchor[] | undefined) =>
  anchors?.find((anchor) => anchor.type === "ticket")?.id ?? null;

export const ticketRefFromLifecyclePayload = (payload: {
  anchors?: ResourceAnchor[];
  branch?: string;
  workspace?: { anchors_json?: ResourceAnchor[]; workspace_shorthand?: string } | null;
}) => ticketRefFromAnchors(payload.workspace?.anchors_json) ?? ticketRefFromAnchors(payload.anchors);
