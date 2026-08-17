import { eventRef } from "@pstdio/sdk/extensions";

export const plannerTicketsChanged = eventRef<{ ticketId?: string }>("pstdio-planner.tickets.changed");
