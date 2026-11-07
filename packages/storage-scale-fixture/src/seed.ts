import { compareRows, createRow, type FixtureRow, type Workload, workload } from "./fixture";

export interface SeedTarget {
  commit(input: { operationId: string; rows: FixtureRow[]; deleted: string[] }): Promise<unknown>;
  /**
   * Creates every resource itself, such as Planner creating tickets through its own command, then
   * saves the first edit. Both lists are in view order; it reports how many it has created.
   */
  create?(created: FixtureRow[], edited: FixtureRow[], progress: (completed: number) => void): Promise<unknown>;
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
  const batchRows = workload(kind).seedBatchRows;
  if (target.create) {
    // Creation follows view order, so an owner that orders by creation shows rows by rank.
    const order = Array.from({ length: count }, (_, index) => createRow(kind, owner, index, 0, churn))
      .sort(compareRows)
      .map((row) => row.ordinal);
    await target.create(
      order.map((index) => createRow(kind, owner, index, 0, churn)),
      order.map((index) => createRow(kind, owner, index, 1, churn)),
      (completed) => progress({ history: 0, completed, count }),
    );
  }
  for (let history = target.create ? 2 : 0; history <= 3; history++) {
    for (let start = 0; start < count; start += batchRows) {
      const rows = Array.from({ length: Math.min(batchRows, count - start) }, (_, offset) =>
        createRow(kind, owner, start + offset, history, churn),
      );
      await target.commit({ operationId: `seed-${kind}-${owner}-${churn}-${history}-${start}`, rows, deleted: [] });
      progress({ history, completed: start + rows.length, count });
    }
  }
  if (churn)
    for (let start = 0; start < count; start += batchRows) {
      const deleted = Array.from(
        { length: Math.min(batchRows, count - start) },
        (_, offset) => createRow(kind, owner, start + offset, 3, true).id,
      );
      await target.commit({ operationId: `churn-delete-${kind}-${owner}-${start}`, rows: [], deleted });
    }
};
