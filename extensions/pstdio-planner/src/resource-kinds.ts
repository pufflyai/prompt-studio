import { defineResourceKind, l10n, projectPrefix, resourceMenuSlotRef } from "@pstdio/sdk/extensions";
import { resolveTicketPathCommand } from "./commands/resolve-ticket-path";
import { ticketRelatedOpeningsCommand } from "./commands/ticket-related-openings";
import { TICKETS_DIR } from "./data/draft-storage";

export const ticketResourceKind = defineResourceKind({
  id: "ticket",
  prefix: projectPrefix(),
  relatedOpenings: ticketRelatedOpeningsCommand.ref,
  label: l10n("resourceKinds.ticket.label", "Ticket"),
  icon: "component",
  paths: [{ prefix: `${TICKETS_DIR}/`, resolve: resolveTicketPathCommand.ref }],
  menuSlots: [
    {
      id: "header-overflow",
      placement: "header-overflow",
      label: l10n("resourceKinds.ticket.actions", "Ticket actions"),
      access: "owner",
    },
  ],
});

export const ticketPageRef = { kind: "page" as const, id: "ticket" };

export const ticketMenuSlots = {
  headerOverflow: resourceMenuSlotRef(ticketResourceKind.ref, "header-overflow"),
};
