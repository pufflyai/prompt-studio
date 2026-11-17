import {
  type CollectionBadgeItem,
  type ExtensionResourcesApi,
  type ResourceRef,
  type ResourceResolution,
  resourceKey,
} from "@pstdio/sdk/extensions";
import { inferReviewLinkTarget } from "./review-links";
import { ticketPageTarget } from "./ticket-page-target";
import type { StoredTicketReviewLink } from "./types";

// Keep the saved display preference identity while broadening it to every resource kind.
export const TICKET_LINKED_RESOURCES_ATTRIBUTE = "workspace";
export const TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE = "linkedResourceItems";
export type TicketLinkedResourceLookup = Map<string, CollectionBadgeItem[]>;

const badgeLabel = (resource: ResourceRef, saved: ResourceRef) =>
  [resource.label, resource.shorthand, saved.label, saved.shorthand].find((label) => label?.trim());

const badgeItem = (saved: ResourceRef, resolved: ResourceResolution | undefined): CollectionBadgeItem | undefined => {
  const resource = resolved?.resource ?? saved;
  const label = badgeLabel(resource, saved);
  // A resource with no stored or resolved label has only an opaque id. Hiding its
  // badge keeps raw ids out of ticket cards while labeled entries stay recognizable.
  if (!label) return undefined;
  const available = Boolean(resolved?.target);
  return {
    id: resourceKey(saved),
    label,
    icon: available ? resource.icon : "circle-alert",
    tooltip: `${resource.extensionId ?? "pstdio"} · ${label}${available ? "" : " · Unavailable"}`,
    ...(resolved?.target ? { action: resolved.target, resource } : {}),
  } satisfies CollectionBadgeItem;
};

export const appendLegacyPullRequestBadges = (items: CollectionBadgeItem[], links: StoredTicketReviewLink[]) => {
  const saved = new Set(
    items.filter((item) => item.resource?.type === "pull-request").map((item) => item.resource?.id),
  );
  const badges = [...items];
  for (const link of links) {
    if (badges.length >= 8) break;
    if (link.provider !== "github" || link.kind !== "pull_request") continue;
    const url = URL.parse(link.url);
    if (url?.protocol !== "https:" || url.username || url.password) continue;
    const { externalId } = inferReviewLinkTarget(url.href);
    if (!externalId || saved.has(url.href)) continue;
    saved.add(url.href);
    badges.push({
      id: `saved-review:${link.id}`,
      label: `#${externalId}`,
      icon: "git-pull-request",
      tooltip: url.href,
      action: { kind: "href", href: url.href },
    });
  }
  return badges;
};

export const loadTicketLinkedResources = async (
  resources: ExtensionResourcesApi,
  tickets: ResourceRef[],
): Promise<TicketLinkedResourceLookup> => {
  const byIdentity = new Map(tickets.map((ticket) => [resourceKey(ticket), new Map<string, ResourceRef>()]));
  const more = new Set<string>();
  for (let start = 0; start < tickets.length; start += 100) {
    const batch = tickets.slice(start, start + 100);
    // A bounded existence query avoids one empty host round trip for every card.
    if (!(await resources.queryRelated({ resources: batch, direction: "both", limit: 1 })).items.length) continue;
    // Each linked card retains its own bounded preview, including hub continuations.
    for (let offset = 0; offset < batch.length; offset += 8)
      await Promise.all(
        batch.slice(offset, offset + 8).map(async (ticket) => {
          const page = await resources.queryRelated({ resources: [ticket], direction: "both", limit: 8 });
          const key = resourceKey(ticket),
            related = byIdentity.get(key)!;
          for (const ref of page.items) if (resourceKey(ref) !== key) related.set(resourceKey(ref), ref);
          if (page.nextCursor) more.add(key);
        }),
      );
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
      [...byIdentity.get(resourceKey(ticket))!.values()]
        .map((ref) => badgeItem(ref, resolved.get(resourceKey(ref))))
        .filter((item): item is CollectionBadgeItem => item !== undefined)
        .concat(
          more.has(resourceKey(ticket))
            ? [
                {
                  id: "linked-resources-more",
                  label: "…",
                  icon: "ellipsis",
                  tooltip: "More linked resources",
                  action: ticketPageTarget(ticket),
                },
              ]
            : [],
        ),
    ]),
  );
};

export const readTicketLinkedResourcePage = async (
  resources: ExtensionResourcesApi,
  ticket: ResourceRef,
  cursor?: string,
) => {
  const page = await resources.queryRelated({
    resources: [ticket],
    direction: "both",
    excludeKinds: ["workspace", "session"],
    limit: 100,
    cursor,
  });
  const resolved = new Map((await resources.resolveMany(page.items)).map((item) => [resourceKey(item.resource), item]));
  return {
    items: page.items.map((ref) => badgeItem(ref, resolved.get(resourceKey(ref)))).filter((item) => item !== undefined),
    nextCursor: page.nextCursor ?? undefined,
  };
};
