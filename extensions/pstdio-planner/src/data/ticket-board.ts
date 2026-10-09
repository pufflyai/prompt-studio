import type { ViewRef } from "@pstdio/sdk/extensions";

// Native Tickets and the timeline share the project's saved ticket views.
export const ticketBoard: ViewRef = { kind: "view", id: "tickets" };
