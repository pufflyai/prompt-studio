import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { answeredReviewRequest, pendingReviewRequest } from "./review-query-indexes";
import { preparePlannerIndexes } from "./storage-indexes";

export const readReviewCounts = async (storage: ExtensionStorageApi, ids: string[]) => {
  if (!ids.length) return new Map<string, { total: number; pending: number; answered: number }>();
  if (ids.length > 100) {
    const result = new Map<string, { total: number; pending: number; answered: number }>();
    for (let start = 0; start < ids.length; start += 100)
      for (const [id, counts] of await readReviewCounts(storage, ids.slice(start, start + 100))) result.set(id, counts);
    return result;
  }
  await preparePlannerIndexes(storage);
  const result = await storage.records.aggregate({
    index: "review-request-state",
    where: { field: "ticketId", op: "in", value: ids },
    groupBy: "ticketId",
    groupLimit: 100,
    computed: {
      pending: { type: "number", cases: [{ when: pendingReviewRequest, value: 1 }], otherwise: 0 },
      answered: { type: "number", cases: [{ when: answeredReviewRequest, value: 1 }], otherwise: 0 },
    },
    metrics: {
      pending: { operation: "sum", field: "pending" },
      answered: { operation: "sum", field: "answered" },
    },
  });
  const groups = new Map(result.groups.map((group) => [String(group.value), group]));
  return new Map(
    ids.map((id) => {
      const group = groups.get(id);
      return [
        id,
        { total: group?.count ?? 0, pending: group?.metrics?.pending ?? 0, answered: group?.metrics?.answered ?? 0 },
      ];
    }),
  );
};
