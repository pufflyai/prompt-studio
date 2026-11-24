import type { StorageRecordIndex } from "@pstdio/sdk/extensions";

export const placementIndexes: StorageRecordIndex[] = [
  {
    name: "timeline-placements",
    collection: "timeline.placements",
    fields: {
      ticketId: { path: ["ticketId"], type: "string" },
      deadlineId: { path: ["deadlineId"], type: "string" },
      position: { path: ["position"], type: "string" },
    },
    equality: ["ticketId"],
    orderBy: [{ field: "position", direction: "asc" }],
  },
  {
    name: "timeline-placement-order",
    collection: "timeline.placements",
    fields: {
      ticketId: { path: ["ticketId"], type: "string" },
      deadlineId: { path: ["deadlineId"], type: "string" },
      position: { path: ["position"], type: "string" },
    },
    equality: ["deadlineId"],
    orderBy: [{ field: "position", direction: "desc" }],
  },
  {
    name: "timeline-gates",
    collection: "timeline.agent-gates",
    fields: { ticketId: { path: ["ticketId"], type: "string" } },
    equality: ["ticketId"],
  },
];
