import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { inferReviewLinkTarget } from "../data/review-links";
import type { StoredTicketReviewLink } from "../data/types";

export const linkReviewCommand = defineCommand({
  id: "link-review",
  title: "Link review",
  cli: {
    globalAliases: [["tickets", "link-review"]],
    examples: ["pst tickets link-review --id PS-1 --url https://github.com/org/repo/pull/456"],
  },
  params: {
    id: params.text({ required: true }),
    url: params.text({ required: true }),
    title: params.text(),
  },
  async run(ctx, commandParams) {
    const ticket = await findTicket(ctx.storage, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);

    const now = new Date().toISOString();
    const reviewLink: StoredTicketReviewLink = {
      id: crypto.randomUUID(),
      url: commandParams.url,
      ...inferReviewLinkTarget(commandParams.url),
      title: commandParams.title ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const next = {
      ...ticket,
      reviewLinks: [...(ticket.reviewLinks ?? []), reviewLink],
      updatedAt: now,
    };

    await ticketsCollection(ctx.storage).put(ticket.id, next);
    return next;
  },
});
