import type { ExtensionContextBase, ExtensionStorageApi, StorageRecord } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "../../data/storage-indexes";
import { plannerSchemaChanged } from "../../events";
import type { Deadline, StoredPlan } from "../contracts";
import { planChanged } from "../contracts";
import { planPlacements } from "./placement-records";

export { type PlanPlacement, planPlacements } from "./placement-records";

export interface PlanMetadata {
  deadlines: Deadline[];
  publicationId?: string;
}
export const metadataKey = "timeline.deadlines";

/** The old array is migration input only. Publish the new catalog after every bounded write succeeds. */
export const readPlanMetadata = async (storage: ExtensionStorageApi) => {
  await preparePlannerIndexes(storage);
  let imported: StorageRecord | undefined;
  await storage.scope({ type: "migration", id: "timeline.placements" }).migrate(1, async (_previous, migration) => {
    const previous = await storage.records.read(storage.records.id("timeline.plan"));
    const legacy = previous.exists && !previous.deleted ? (previous.value as unknown as StoredPlan) : undefined;
    if (legacy) imported = previous;
    const known = new Set(legacy?.deadlines.map(({ id }) => id) ?? []);
    const seen = new Set<string>();
    const entries = legacy?.order ?? [];
    const placements = planPlacements(storage);
    for (let offset = 0; offset < entries.length; offset += 100) {
      const batch = entries.slice(offset, offset + 100).flatMap((entry, index) => {
        if (seen.has(entry.ticketId)) return [];
        seen.add(entry.ticketId);
        return [
          {
            ...entry,
            deadlineId: entry.deadlineId && known.has(entry.deadlineId) ? entry.deadlineId : null,
            position: migration.position(offset + index, entry.ticketId),
          },
        ];
      });
      for (let start = 0; start < batch.length; start += 8)
        await Promise.all(
          batch.slice(start, start + 8).map((entry) => placements.createIfAbsent(entry.ticketId, entry)),
        );
    }
    const published = await storage.get<PlanMetadata>(metadataKey);
    if (legacy || !published)
      await storage.set<PlanMetadata>(metadataKey, {
        deadlines: legacy?.deadlines ?? [],
        publicationId: storage.ids.create(),
      });
  });
  if (imported)
    await storage.records.commit({
      operationId: storage.ids.create(),
      edits: [{ recordId: imported.recordId, expectedRevision: imported.revision, deleted: true }],
    });
  return (await storage.get<PlanMetadata>(metadataKey)) ?? { deadlines: [] };
};

export const readPlanMetadataSnapshot = async (storage: ExtensionStorageApi) => {
  await readPlanMetadata(storage);
  const record = await storage.records.read(storage.records.id(metadataKey));
  return { metadata: record.value as unknown as PlanMetadata, revision: record.revision };
};

export const writePlanMetadata = async (
  storage: ExtensionStorageApi,
  metadata: PlanMetadata,
  expectedRevision?: string,
) => {
  const observed = await readPlanMetadataSnapshot(storage);
  const publicationId = storage.ids.create();
  const outcome = await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [
      {
        recordId: storage.records.id(metadataKey),
        expectedRevision: expectedRevision ?? observed.revision,
        set: {
          "/deadlines": metadata.deadlines.map((deadline) => ({ ...deadline })),
          "/publicationId": publicationId,
        },
      },
    ],
  });
  if (outcome.state === "refused" || outcome.state === "needs-attention")
    throw new Error(outcome.reason ?? "Plan metadata changed before publication");
  if ((await storage.get<PlanMetadata>(metadataKey))?.publicationId !== publicationId)
    throw new Error("Plan metadata publication is not visible; inspect save status before continuing");
};

export const readTicketPlan = async (storage: ExtensionStorageApi, ticketId: string) => {
  const metadata = await readPlanMetadata(storage);
  const placement = await planPlacements(storage).get(ticketId);
  const deadlineId = metadata.deadlines.some(({ id }) => id === placement?.deadlineId) ? placement!.deadlineId : null;
  return { ...metadata, order: placement ? [{ ticketId, deadlineId }] : [] };
};

export const savePlanMetadata = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events">,
  metadata: PlanMetadata,
  expectedRevision?: string,
) => {
  await writePlanMetadata(ctx.storage, metadata, expectedRevision);
  await ctx.events.emit(planChanged, { reason: "deadline" });
  await ctx.events.emit(plannerSchemaChanged, {});
};
