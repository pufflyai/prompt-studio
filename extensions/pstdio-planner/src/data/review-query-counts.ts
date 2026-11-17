import type { ExtensionStorageApi, StoragePredicate } from "@pstdio/sdk/extensions";
import { answeredReviewRequest, pendingReviewRequest } from "./review-query-indexes";

export const readReviewCounts = async (storage: ExtensionStorageApi, ids: string[]) => {
  if (!ids.length) return new Map<string, { total: number; pending: number; answered: number }>();
  if (ids.length > 100) {
    const result = new Map<string, { total: number; pending: number; answered: number }>();
    for (let start = 0; start < ids.length; start += 100)
      for (const [id, counts] of await readReviewCounts(storage, ids.slice(start, start + 100))) result.set(id, counts);
    return result;
  }
  const selected: StoragePredicate = { field: "ticketId", op: "in", value: ids };
  const count = (where?: StoragePredicate) =>
    storage.records.aggregate({
      index: "review-request-state",
      where: where ? { all: [selected, where] } : selected,
      groupBy: "ticketId",
      groupLimit: 100,
    });
  const [total, pending, answered] = await Promise.all([
    count(),
    count(pendingReviewRequest),
    count(answeredReviewRequest),
  ]);
  const byId = (result: typeof total) => new Map(result.groups.map((group) => [String(group.value), group.count]));
  const totals = byId(total),
    pendingCounts = byId(pending),
    answeredCounts = byId(answered);
  return new Map(
    ids.map((id) => [
      id,
      { total: totals.get(id) ?? 0, pending: pendingCounts.get(id) ?? 0, answered: answeredCounts.get(id) ?? 0 },
    ]),
  );
};
