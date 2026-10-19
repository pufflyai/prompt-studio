import { defineResourceKind, l10n, projectPrefix, resourceMenuSlotRef } from "@pstdio/sdk/extensions";
import { ticketRelatedOpeningsCommand } from "./commands/ticket-related-openings";

export const ticketResourceKind = defineResourceKind({
  id: "ticket",
  prefix: projectPrefix(),
  relatedOpenings: ticketRelatedOpeningsCommand.ref,
  label: l10n("resourceKinds.ticket.label", "Ticket"),
  icon: "component",
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
