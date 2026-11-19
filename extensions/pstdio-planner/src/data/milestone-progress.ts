import type { ExtensionStorageApi, StoragePredicate } from "@pstdio/sdk/extensions";

export const readMilestoneProgress = async (
  storage: ExtensionStorageApi,
  ids: string[],
  active: StoragePredicate,
  done: StoragePredicate,
) => {
  const counts = new Map<string, number>();
  const doneCounts = new Map<string, number>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const progress = await storage.records.aggregate({
      index: "ticket-view",
      where: { all: [active, { field: "deadlineId", op: "in", value: ids.slice(offset, offset + 100) }] },
      groupBy: "deadlineId",
      groupLimit: 100,
      computed: { completedMilestoneTicket: { type: "number", cases: [{ when: done, value: 1 }], otherwise: 0 } },
      metrics: { done: { operation: "sum", field: "completedMilestoneTicket" } },
    });
    for (const group of progress.groups) {
      counts.set(String(group.value), group.count);
      doneCounts.set(String(group.value), group.metrics?.done ?? 0);
    }
  }
  return { counts, doneCounts };
};
