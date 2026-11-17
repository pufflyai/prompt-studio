import {
  type ExtensionContextBase,
  l10n,
  type RendererContext,
  type ResourceRef,
  type ResourceResolution,
  resourceKey,
  type TreeViewSection,
} from "@pstdio/sdk/extensions";

const sectionFor = (resource: ResourceRef) => {
  if (resource.type === "ticket") return { id: "tickets", label: l10n("links.tickets", "Tickets") };
  if (resource.type === "workspace") return { id: "workspaces", label: l10n("links.workspaces", "Workspaces") };
  if (resource.type === "session") return { id: "sessions", label: l10n("sessions.title", "Sessions") };
  return { id: "related", label: l10n("links.related", "Related resources") };
};

export const listSessionLinks = async (
  ctx: Pick<ExtensionContextBase, "resources" | "projectId">,
  input: { renderer?: RendererContext },
) => {
  const selected = input.renderer?.resource;
  if (selected?.type !== "session") return [];
  const resource = {
    ...selected,
    projectId: selected.projectId ?? ctx.projectId,
    extensionId: selected.extensionId ?? "pstdio",
  };
  const key = resourceKey(resource);
  const peers = new Map<string, ResourceRef>();
  let cursor: string | undefined;
  do {
    const page = await ctx.resources.queryAnchors({ resource, direction: "both", limit: 100, cursor });
    for (const edge of page.items) {
      const peer = resourceKey(edge.source) === key ? edge.target : edge.source;
      if (resourceKey(peer) !== key) peers.set(resourceKey(peer), peer);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  const refs = [...peers.values()];
  const resolved: ResourceResolution[] = [];
  for (let offset = 0; offset < refs.length; offset += 100)
    resolved.push(...(await ctx.resources.resolveMany(refs.slice(offset, offset + 100))));
  const sections = new Map<string, TreeViewSection>();
  for (const { resource: peer, target } of resolved) {
    const group = sectionFor(peer);
    const section = sections.get(group.id) ?? { ...group, collapsible: true, nodes: [] };
    section.nodes.push({
      id: resourceKey(peer),
      label: peer.label ?? peer.shorthand ?? l10n("links.unavailable", "Unavailable resource"),
      icon: peer.icon ?? "link",
      resource: peer,
      target,
      disabled: !target,
    });
    sections.set(group.id, section);
  }
  return [...sections.values()];
};
