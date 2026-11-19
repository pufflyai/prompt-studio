import { type CollectionBadgeItem, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { ticketLinkedResourcePreview } from "./ticket-linked-resources";
import type { StoredTicketReviewLink } from "./types";

export const appendLegacyPullRequestBadges = (
  items: CollectionBadgeItem[],
  links: StoredTicketReviewLink[],
  projectId: string,
  preview?: ResourceRef,
) => {
  const saved = new Set(items.map(({ id }) => id));
  const badges = [...items];
  for (const link of links) {
    if (link.provider !== "github" || link.kind !== "pull_request") continue;
    const url = URL.parse(link.url);
    if (
      !url ||
      url.hostname !== "github.com" ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      continue;
    const match = /^\/([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9._-]+)\/pull\/(\d+)(?:\/.*)?$/.exec(url.pathname);
    const number = Number(match?.[3]);
    if (!match || !Number.isSafeInteger(number) || number < 1) continue;
    const href = `https://github.com/${match[1].toLowerCase()}/${match[2].toLowerCase()}/pull/${number}`;
    const id = resourceKey({ extensionId: "pstdio.github", projectId, type: "pull-request", id: href });
    if (saved.has(id)) continue;
    saved.add(id);
    badges.push({
      id,
      label: `#${number}`,
      icon: "git-pull-request",
      tooltip: href,
      action: { kind: "href", href },
    });
  }
  return preview ? ticketLinkedResourcePreview(badges, preview) : badges;
};
