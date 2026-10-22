import { createRow, type FixtureRow, type Workload } from "./fixture";

export interface SeedTarget {
  commit(input: { operationId: string; rows: FixtureRow[]; deleted: string[] }): Promise<unknown>;
}

// Fixed atomic groups also exercise real history/folding. Seeding is outside all foreground timers.
export const seedOwner = async (
  target: SeedTarget,
  kind: Workload,
  owner: number,
  count: number,
  churn: boolean,
  progress: (input: { history: number; completed: number; count: number }) => void,
) => {
  for (let history = 0; history <= 3; history++) {
    for (let start = 0; start < count; start += 100) {
      const rows = Array.from({ length: Math.min(100, count - start) }, (_, offset) =>
        createRow(kind, owner, start + offset, history, churn),
      );
      await target.commit({ operationId: `seed-${kind}-${owner}-${churn}-${history}-${start}`, rows, deleted: [] });
      progress({ history, completed: start + rows.length, count });
    }
  }
  if (churn)
    for (let start = 0; start < count; start += 100) {
      const deleted = Array.from(
        { length: Math.min(100, count - start) },
        (_, offset) => createRow(kind, owner, start + offset, 3, true).id,
      );
      await target.commit({ operationId: `churn-delete-${kind}-${owner}-${start}`, rows: [], deleted });
    }
};
