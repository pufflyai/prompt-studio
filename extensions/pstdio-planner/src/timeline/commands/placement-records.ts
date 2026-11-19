import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

export interface PlanPlacement {
  ticketId: string;
  deadlineId: string | null;
  position: string;
}

export const placementKeyPrefix = "timeline.placement:";
export const placementRecordId = (storage: ExtensionStorageApi, ticketId: string) =>
  storage.records.id(`${placementKeyPrefix}${ticketId}`);

export const planPlacements = (storage: ExtensionStorageApi) => ({
  get: (ticketId: string) => storage.get<PlanPlacement>(`${placementKeyPrefix}${ticketId}`),
  put: (ticketId: string, placement: PlanPlacement) => storage.set(`${placementKeyPrefix}${ticketId}`, placement),
  async createIfAbsent(ticketId: string, placement: PlanPlacement) {
    const before = await storage.records.read(placementRecordId(storage, ticketId));
    if (before.exists && !before.deleted) return false;
    const outcome = await storage.records.commit({
      operationId: storage.ids.create(),
      edits: [
        { recordId: before.recordId, expectedRevision: before.revision, deleted: false, replace: { ...placement } },
      ],
    });
    if (outcome.state === "refused" || outcome.state === "needs-attention")
      throw new Error(outcome.reason ?? "Plan placement changed before publication");
    return true;
  },
});
