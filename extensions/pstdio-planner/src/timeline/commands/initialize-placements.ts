import { createCollectionRecordsIfAbsent } from "@pstdio/sdk/data";
import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { withQueuedWriteGuard } from "../../data/write-guard";
import { nextPlacementBatch, PLACEMENT_BATCH_SIZE, readUnplacedPlanTicket } from "./placement-batch";
import { readPlanMetadata } from "./placement-store";

const activePlacements = (storage: ExtensionStorageApi) =>
  storage.records.aggregate({
    index: "timeline-placement-order",
    where: {
      exists: {
        index: "ticket-view",
        on: [{ sourceField: "ticketId", relatedField: "id" }],
        where: { field: "archived", op: "ne", value: true },
      },
    },
  });

/** Append canonical batches until the requested active execution prefix is durable. */
const initializePlacements = async (
  storage: ExtensionStorageApi,
  completedStatusIds: string[],
  requiredActiveCount?: number,
) => {
  await readPlanMetadata(storage);
  let previous: unknown;
  let hasTail = false;
  for (;;) {
    // Recount actual active rows: an archive can race the preceding batch commit.
    const prefix = requiredActiveCount === undefined ? undefined : await activePlacements(storage);
    if (prefix && prefix.count >= requiredActiveCount!) return prefix.revision;
    if (!hasTail) {
      const tail = await storage.records.query({
        index: "timeline-placements",
        fields: ["position"],
        orderBy: [{ field: "position", direction: "desc" }],
        limit: 1,
      });
      previous = tail.records[0]?.fields.position;
      hasTail = true;
    }
    const page = await nextPlacementBatch(storage, completedStatusIds);
    if (!page.length) {
      if (prefix)
        await storage.records.query({
          index: "ticket-view",
          fields: [],
          orderBy: [],
          limit: 0,
          revision: prefix.revision,
        });
      return prefix?.revision;
    }
    const placements = page.map((row) => {
      const ticketId = String(row.fields.id);
      const position = storage.positions.between(typeof previous === "string" ? previous : undefined);
      previous = position;
      return { id: ticketId, value: { ticketId, deadlineId: null, position } };
    });
    await createCollectionRecordsIfAbsent(storage, "timeline.placements", placements);
    if (requiredActiveCount !== undefined && page.length < PLACEMENT_BATCH_SIZE) {
      // Only a fresh post-commit read proves exhaustion; new work may have arrived during the write.
      const remaining = await readUnplacedPlanTicket(storage);
      if (!remaining.records.length) return remaining.revision;
    }
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
