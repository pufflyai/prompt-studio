import type { ExtensionContextBase, ExtensionStorageApi, StoragePredicate } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "../../data/storage-indexes";
import { plannerSchemaChanged } from "../../events";
import type { Deadline, StoredPlan } from "../contracts";
import { planChanged } from "../contracts";

export interface PlanPlacement {
  ticketId: string;
  deadlineId: string | null;
  position: string;
}
export interface PlanMetadata {
  deadlines: Deadline[];
}
const metadataKey = "timeline.deadlines";
export const planPlacements = (storage: ExtensionStorageApi) =>
  storage.collection<PlanPlacement>("timeline.placements");

// Retain only migration completion for this storage API's lifetime; metadata is always read afresh.
const metadataMigrations = new WeakMap<ExtensionStorageApi, Promise<void>>();
const migratePlanMetadata = (storage: ExtensionStorageApi) => {
  const existing = metadataMigrations.get(storage);
  if (existing) return existing;
  const ready = storage
    .scope({ type: "migration", id: "timeline.placements" })
    .migrate(1, async (_previous, migration) => {
      const legacy = await storage.get<StoredPlan>("timeline.plan");
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
      await storage.set<PlanMetadata>(metadataKey, { deadlines: legacy?.deadlines ?? [] });
      if (legacy) await storage.delete("timeline.plan");
    })
    .then(() => {})
    .catch((error: unknown) => {
      metadataMigrations.delete(storage);
      throw error;
    });
  metadataMigrations.set(storage, ready);
  return ready;
};

/** The old array is migration input only. Publish the new catalog after every bounded write succeeds. */
export const readPlanMetadata = async (storage: ExtensionStorageApi) => {
  await preparePlannerIndexes(storage);
  await migratePlanMetadata(storage);
  return (await storage.get<PlanMetadata>(metadataKey)) ?? { deadlines: [] };
};

export const writePlanMetadata = async (storage: ExtensionStorageApi, metadata: PlanMetadata) => {
  await readPlanMetadata(storage);
  await storage.set(metadataKey, metadata);
};

export const savePlanMetadata = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events">,
  metadata: PlanMetadata,
) => {
  await writePlanMetadata(ctx.storage, metadata);
  await ctx.events.emit(planChanged, { reason: "deadline" });
  await ctx.events.emit(plannerSchemaChanged, {});
};

export const clearDeadlinePlacements = async (storage: ExtensionStorageApi, deadlineId: string) => {
  for (;;) {
    const page = await storage.records.query({
      index: "timeline-placement-order",
      where: { field: "deadlineId", op: "eq", value: deadlineId },
      fields: ["ticketId"],
      limit: 100,
    });
    if (!page.records.length) return;
    for (const row of page.records) {
      const id = String(row.fields.ticketId);
      const placement = await planPlacements(storage).get(id);
      if (placement) await planPlacements(storage).update(id, { ...placement, deadlineId: null });
    }
  }
};

/** Write one canonical placement. Unloaded placements are never rewritten. */
export const movePlanPlacement = async (
  storage: ExtensionStorageApi,
  input: { ticketId: string; deadlineId: string | null; beforeId?: string },
) => {
  const metadata = await readPlanMetadata(storage);
  if (input.deadlineId && !metadata.deadlines.some(({ id }) => id === input.deadlineId))
    throw new Error(`Unknown deadline "${input.deadlineId}".`);
  const placements = planPlacements(storage);
  const current = await placements.get(input.ticketId);
  if (input.beforeId === input.ticketId) return current;
  const target = input.beforeId ? await placements.get(input.beforeId) : undefined;
  const before = target?.deadlineId === input.deadlineId ? target : undefined;
  const selection: StoragePredicate[] = [
    { field: "deadlineId", op: "eq", value: input.deadlineId },
    { field: "ticketId", op: "ne", value: input.ticketId },
    ...(before ? [{ field: "position", op: "lt", value: before.position } satisfies StoragePredicate] : []),
  ];
  const previous = (
    await storage.records.query({
      index: "timeline-placement-order",
      where: { all: selection },
      fields: ["position"],
      limit: 1,
    })
  ).records[0];
  const lower = previous?.fields.position;
  const position = storage.positions.between(typeof lower === "string" ? lower : undefined, before?.position);
  const next = { ticketId: input.ticketId, deadlineId: input.deadlineId, position };
  await placements.put(input.ticketId, next);
  return next;
};
