import { defineResourceKind, l10n, resourceMenuSlotRef } from "@pstdio/sdk/extensions";

export const ticketResourceKind = defineResourceKind({
  id: "ticket",
  surface: "primary",
  label: l10n("resourceKinds.ticket.label", "Ticket"),
  icon: "component",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "navigation", cardinality: "one", access: "public" },
  ],
  menuSlots: [
    {
      id: "headerOverflow",
      placement: "header-overflow",
      label: l10n("resourceKinds.ticket.actions", "Ticket actions"),
      access: "owner",
    },
  ],
});

export const ticketMenuSlots = {
  headerOverflow: resourceMenuSlotRef(ticketResourceKind.ref, "headerOverflow"),
};
