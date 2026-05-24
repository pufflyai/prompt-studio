import type { AttributeBadge } from "@pstdio/ui";
import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty } from "../types";

type BadgeBuilder = (ticket: Ticket, context: BadgeContext) => AttributeBadge[];

const builders: Record<DisplayProperty, BadgeBuilder> = {
  parentId: (ticket, context) => {
    if (!ticket.parentId) return [];

    const parentLabel = context.ticketShorthandById?.[ticket.parentId] ?? ticket.parentId;
    return [{ attributeId: "parentId", label: parentLabel }];
  },

  status: (ticket) => [{ attributeId: "status", label: ticket.status, color: ticket.statusColor }],

  assignee: (ticket) => (ticket.assignee ? [{ attributeId: "assignee", label: ticket.assignee }] : []),

  tags: (ticket, context) =>
    ticket.tagIds
      .map((id) => context.tagMap.get(id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
      .map((tag) => ({ attributeId: `tag:${tag.id}`, label: tag.name, color: tag.color })),

  updatedAt: (ticket) => [{ attributeId: "updatedAt", label: new Date(ticket.updatedAt).toLocaleDateString() }],
};

export const buildTicketBadges = (ticket: Ticket, displayProperties: DisplayProperty[], context: BadgeContext) =>
  displayProperties.flatMap((property) => builders[property](ticket, context));
