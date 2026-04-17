import type { TicketCardBadge } from "./ticket-card";
import type { DisplayProperty, WorkspaceTicket } from "./types";

interface BadgeOptions {
  displayProperties: DisplayProperty[];
  statusColorMap?: Record<string, string>;
  canFilterLabels?: boolean;
  onLabelClick?: (label: string) => void;
}

export const createTicketBadges = (ticket: WorkspaceTicket, options: BadgeOptions): TicketCardBadge[] => {
  const { displayProperties, statusColorMap, canFilterLabels = true, onLabelClick } = options;
  const badges: TicketCardBadge[] = [];
  const includes = (property: DisplayProperty) => displayProperties.includes(property);

  if (includes("status") && ticket.status) {
    const color = statusColorMap?.[ticket.status] ?? ticket.statusColor ?? "gray";
    badges.push({ id: `status:${ticket.status}`, label: ticket.status, color });
  }

  if (includes("assignee") && ticket.assignee) {
    badges.push({ id: `assignee:${ticket.assignee}`, label: ticket.assignee, color: "gray" });
  }

  if (includes("updated") && ticket.updatedAt) {
    badges.push({
      id: `updated:${ticket.updatedAt}`,
      label: new Date(ticket.updatedAt).toLocaleDateString(),
      color: "gray",
    });
  }

  if (includes("labels")) {
    for (const [index, label] of (ticket.labels ?? []).entries()) {
      badges.push({
        id: `label:${label}:${index}`,
        label,
        color: "purple",
        onClick: canFilterLabels && onLabelClick ? () => onLabelClick(label) : undefined,
      });
    }
  }

  return badges;
};

export type { BadgeOptions };
