import { createCollectionRecordsIfAbsent } from "@pstdio/sdk/data";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { nextPlacementBatch } from "./placement-batch";
import { readPlanMetadata } from "./placement-store";

/** Order the remaining metadata in the database, then create one bounded placement batch. */
export const initializePlanPlacements = async (storage: ExtensionStorageApi, completedStatusIds: string[]) => {
  await readPlanMetadata(storage);
  const tail = await storage.records.query({
    index: "timeline-placements",
    fields: ["position"],
    orderBy: [{ field: "position", direction: "desc" }],
    limit: 1,
  });
  let previous = tail.records[0]?.fields.position;
  for (;;) {
    const page = await nextPlacementBatch(storage, completedStatusIds);
    if (!page.length) return;
    const placements = page.map((row) => {
      const ticketId = String(row.fields.id);
      const position = storage.positions.between(typeof previous === "string" ? previous : undefined);
      previous = position;
      return { id: ticketId, value: { ticketId, deadlineId: null, position } };
    });
    await createCollectionRecordsIfAbsent(storage, "timeline.placements", placements);
  }
};
