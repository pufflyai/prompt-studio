import { createCollectionRecordsIfAbsent } from "@pstdio/sdk/data";
import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { withQueuedWriteGuard } from "../../data/write-guard";
import { nextPlacementBatch } from "./placement-batch";
import { readPlanMetadata } from "./placement-store";

/** Order the remaining metadata in the database, then create one bounded placement batch. */
const initializePlacements = async (
  storage: ExtensionStorageApi,
  completedStatusIds: string[],
  requiredActiveCount?: number,
) => {
  await readPlanMetadata(storage);
  let initialized = 0;
  if (requiredActiveCount !== undefined) {
    initialized = (
      await storage.records.aggregate({
        index: "timeline-placement-order",
        where: {
          exists: {
            index: "ticket-view",
            on: [{ sourceField: "ticketId", relatedField: "id" }],
            where: { field: "archived", op: "ne", value: true },
          },
        },
      })
    ).count;
    if (initialized >= requiredActiveCount) return;
  }
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
    initialized += placements.length;
    if (requiredActiveCount !== undefined && initialized >= requiredActiveCount) return;
  }
};

export const initializePlanPlacements = (
  ctx: Pick<ExtensionContextBase, "storage" | "projectId" | "extensionId">,
  completedStatusIds: string[],
  requiredActiveCount?: number,
) =>
  // Serialize each owner's tail read and all pending batches, including read-triggered initialization.
  withQueuedWriteGuard(ctx, "plan-initialization", () =>
    initializePlacements(ctx.storage, completedStatusIds, requiredActiveCount),
  );
