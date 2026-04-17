import type { TicketCardBadge } from "@pstdio/ui";
import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty } from "../types";

type BadgeBuilder = (ticket: Ticket, context: BadgeContext) => TicketCardBadge[];

const builders: Record<DisplayProperty, BadgeBuilder> = {
  parentId: (ticket, context) => {
    if (!ticket.parentId) return [];

    const parentLabel = context.ticketShorthandById?.[ticket.parentId] ?? ticket.parentId;
    return [{ id: `parent:${ticket.parentId}`, label: parentLabel }];
  },

  status: (ticket) => [{ id: `status:${ticket.status}`, label: ticket.status, color: ticket.statusColor }],

  assignee: (ticket) => (ticket.assignee ? [{ id: `assignee:${ticket.assignee}`, label: ticket.assignee }] : []),

  tags: (ticket, context) => {
    return ticket.tagIds
      .map((id) => context.tagMap.get(id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
      .map((tag) => ({ id: `tag:${tag.id}`, label: tag.name, color: tag.color }));
  },

  updatedAt: (ticket) => [
    { id: `updated:${ticket.updatedAt}`, label: new Date(ticket.updatedAt).toLocaleDateString() },
  ],
};

export const buildTicketBadges = (ticket: Ticket, displayProperties: DisplayProperty[], context: BadgeContext) =>
  displayProperties.flatMap((property) => builders[property](ticket, context));
