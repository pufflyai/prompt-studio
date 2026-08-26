import { eventRef } from "@pstdio/sdk/extensions";

export const plannerTicketsChanged = eventRef<{ ticketId?: string }>({
  extensionId: "pstdio.pstdio-planner",
  id: "tickets.changed",
});
