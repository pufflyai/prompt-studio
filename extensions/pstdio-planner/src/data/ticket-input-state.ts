import type { ExtensionStorageApi, StoragePredicate } from "@pstdio/sdk/extensions";
import { pendingReviewRequest } from "./review-query-indexes";
import { preparePlannerIndexes } from "./storage-indexes";

export interface TicketInputState {
  pending: boolean;
  pendingImplementation: boolean;
}
export const readTicketInputStates = async (storage: ExtensionStorageApi, ids: string[]) => {
  await preparePlannerIndexes(storage);
  const result = new Map<string, TicketInputState>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const where: StoragePredicate = { all: [{ field: "ticketId", op: "in", value: batch }, pendingReviewRequest] };
    const implementation: StoragePredicate = {
      any: [
        { field: "valid", op: "ne", value: true },
        {
          all: [
            { field: "affectedAction", op: "ne", value: "merge" },
            { field: "reason", op: "ne", value: "approved-revision" },
          ],
        },
      ],
    };
    const [all, work] = await Promise.all([
      storage.records.aggregate({ index: "review-request-state", where, groupBy: "ticketId", groupLimit: 100 }),
      storage.records.aggregate({
        index: "review-request-state",
        where: { all: [where, implementation] },
        groupBy: "ticketId",
        groupLimit: 100,
      }),
    ]);
    if (all.revision !== work.revision) throw new Error("Review input changed; read it again");
    const pending = new Set(all.groups.map(({ value }) => String(value)));
    const pendingImplementation = new Set(work.groups.map(({ value }) => String(value)));
    for (const id of batch)
      result.set(id, { pending: pending.has(id), pendingImplementation: pendingImplementation.has(id) });
  }
  return result;
};
