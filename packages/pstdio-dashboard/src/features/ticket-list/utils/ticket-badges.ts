import type { TicketCardBadge } from "@pstdio/ui";
import type { Ticket } from "@/features/ticket-list/types";

import type { BadgeContext, DisplayProperty } from "../types";

type BadgeBuilder = (ticket: Ticket, context: BadgeContext) => TicketCardBadge[];

const builders: Record<DisplayProperty, BadgeBuilder> = {
  parentId: (ticket, context) => {
    if (!ticket.parentId) return [];

    const parentLabel = context.ticketShorthandById?.[ticket.parentId] ?? ticket.parentId;
    return [{ label: parentLabel }];
  },

  status: (ticket) => [{ label: ticket.status, color: ticket.statusColor }],

  complexity: (ticket) => (ticket.complexity ? [{ label: ticket.complexity }] : []),

  assignee: (ticket) => (ticket.assignee ? [{ label: ticket.assignee }] : []),

  tags: (ticket, context) => {
    return ticket.tagIds
      .map((id) => context.tagMap.get(id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
      .map((tag) => ({ label: tag.name, color: tag.color }));
  },

  updatedAt: (ticket) => [{ label: new Date(ticket.updatedAt).toLocaleDateString() }],
};

export const buildTicketBadges = (ticket: Ticket, displayProperties: DisplayProperty[], context: BadgeContext) =>
  displayProperties.flatMap((property) => builders[property](ticket, context));
