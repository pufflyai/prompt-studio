import type { ViewRef } from "@pstdio/sdk/extensions";

// Each presentation owns its saved views over the same ticket records.
export const ticketBoard: ViewRef = { kind: "view", id: "tickets" };
export const timelineBoard: ViewRef = { kind: "view", id: "timeline-tickets" };

export const DEFAULT_TIMELINE_DISPLAY_PROPERTIES = ["status", "needsAttention"];
