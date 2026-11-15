import { eventRef } from "@pstdio/sdk/extensions";

export const plannerTicketsChanged = eventRef<{ ticketId?: string }>({
  extensionId: "pstdio.planner",
  id: "tickets.changed",
});

export const plannerSchemaChanged = eventRef({ extensionId: "pstdio.planner", id: "schema.changed" });
