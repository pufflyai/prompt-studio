import { defineResourceKind, l10n, resourceMenuSlotRef } from "@pstdio/sdk/extensions";

export const ticketResourceKind = defineResourceKind({
  id: "ticket",
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

export const ticketMenuSlots = {
  headerOverflow: resourceMenuSlotRef(ticketResourceKind.ref, "header-overflow"),
};
