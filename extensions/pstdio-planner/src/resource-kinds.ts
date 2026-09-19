import { defineResourceKind, projectPrefix, resourceMenuSlotRef } from "@pstdio/sdk/extensions";

export const ticketResourceKind = defineResourceKind({
  id: "ticket",
  prefix: projectPrefix(),
  label: "Ticket",
  icon: "component",
  menuSlots: [
    {
      id: "header-overflow",
      placement: "header-overflow",
      label: "Ticket actions",
      access: "owner",
    },
  ],
});

export const ticketPageRef = { kind: "page" as const, id: "ticket" };

export const ticketMenuSlots = {
  headerOverflow: resourceMenuSlotRef(ticketResourceKind.ref, "header-overflow"),
};
