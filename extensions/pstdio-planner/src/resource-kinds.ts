import { defineResourceKind, l10n, projectPrefix, resourceMenuSlotRef } from "@pstdio/sdk/extensions";

import { resolveTicketResourcesCommand } from "./commands/resolve-ticket-resources";

export const ticketResourceKind = defineResourceKind({
  id: "ticket",
  prefix: projectPrefix(),
  label: l10n("resourceKinds.ticket.label", "Ticket"),
  icon: "component",
  resolveMany: resolveTicketResourcesCommand.ref,
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
