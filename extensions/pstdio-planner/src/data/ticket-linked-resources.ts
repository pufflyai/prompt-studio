import {
  type CollectionBadgeItem,
  type ExtensionResourcesApi,
  type ResourceRef,
  type ResourceResolution,
  resourceKey,
} from "@pstdio/sdk/extensions";

// Keep the saved display preference identity while broadening it to every resource kind.
export const TICKET_LINKED_RESOURCES_ATTRIBUTE = "workspace";
export const TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE = "linkedResourceItems";
export type TicketLinkedResourceLookup = Map<string, CollectionBadgeItem[]>;

const badgeItem = (saved: ResourceRef, resolved: ResourceResolution | undefined) => {
  const resource = resolved?.resource ?? saved;
  const label = resource.label ?? resource.shorthand ?? saved.label ?? saved.shorthand ?? resource.id;
  const available = Boolean(resolved?.target);
  return {
    id: resourceKey(saved),
    label,
    icon: available ? resource.icon : "circle-alert",
    tooltip: `${resource.extensionId ?? "pstdio"} · ${label}${available ? "" : " · Unavailable"}`,
    ...(resolved?.target ? { action: resolved.target, resource } : {}),
  } satisfies CollectionBadgeItem;
};

const addRelatedReference = (
  lookup: Map<string, Map<string, ResourceRef>>,
  source: ResourceRef,
  target: ResourceRef,
) => {
  const linked = lookup.get(resourceKey(source));
  const key = resourceKey(target);
  if (!linked || resourceKey(source) === key) return;
  const previous = linked.get(key);
  linked.set(key, { ...previous, ...target, label: target.label ?? previous?.label });
};

export const loadTicketLinkedResources = async (resources: ExtensionResourcesApi, tickets: ResourceRef[]) => {
  const byIdentity = new Map(tickets.map((ticket) => [resourceKey(ticket), new Map<string, ResourceRef>()]));
  // Keep both directions on the same path. A workspace's ticket anchor is an incoming link.
  for (let offset = 0; offset < tickets.length; offset += 100) {
    const batch = tickets.slice(offset, offset + 100);
    let cursor: string | undefined;
    do {
      const page = await resources.queryAnchorsMany({ resources: batch, direction: "both", limit: 100, cursor });
      for (const edge of page.items) {
        addRelatedReference(byIdentity, edge.source, edge.target);
        addRelatedReference(byIdentity, edge.target, edge.source);
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
  const unique = new Map([...byIdentity.values()].flatMap((refs) => [...refs]));
  const refs = [...unique.values()];
  const batches: ResourceRef[][] = [];
  for (let offset = 0; offset < refs.length; offset += 100) {
    batches.push(refs.slice(offset, offset + 100));
  }
  const resolved = new Map<string, ResourceResolution>(
    (await Promise.all(batches.map((batch) => resources.resolveMany(batch))))
      .flat()
      .map((item) => [resourceKey(item.resource), item]),
  );
  return new Map(
    tickets.map((ticket) => [
      ticket.id,
      [...byIdentity.get(resourceKey(ticket))!.values()].map((ref) => badgeItem(ref, resolved.get(resourceKey(ref)))),
    ]),
  );
};
