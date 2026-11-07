import { expect, test } from "bun:test";
import { compareRows, type FixtureRow } from "./fixture";
import { seedOwner } from "./seed";

test("full preparation preserves every create and three edits and keeps churn separate", async () => {
  const live = new Map<string, FixtureRow>();
  const histories = new Map<string, number[]>();
  const target = {
    async commit(input: { rows: FixtureRow[]; deleted: string[] }) {
      for (const row of input.rows) {
        live.set(row.id, row);
        histories.set(row.id, [...(histories.get(row.id) ?? []), row.history]);
      }
      for (const id of input.deleted) live.delete(id);
    },
  };
  await seedOwner(target, "small", 0, 1_000, false, () => {});
  await seedOwner(target, "small", 0, 1_000, true, () => {});
  expect(live.size).toBe(1_000);
  expect(histories.size).toBe(2_000);
  for (const history of histories.values()) expect(history).toEqual([0, 1, 2, 3]);
  expect([...live.values()].every((row) => row.history === 3)).toBe(true);
});

test("an owner that creates its own resources gets them in view order, then the same three edits", async () => {
  const histories = new Map<string, number[]>();
  let created: FixtureRow[] = [];
  const record = (rows: FixtureRow[]) => {
    for (const row of rows) histories.set(row.id, [...(histories.get(row.id) ?? []), row.history]);
  };
  await seedOwner(
    {
      async create(rows, edited) {
        created = rows;
        record(rows);
        record(edited);
      },
      async commit(input) {
        record(input.rows);
      },
    },
    "rich",
    9,
    500,
    false,
    () => {},
  );
  expect(created.map((row) => row.id)).toEqual([...created].sort(compareRows).map((row) => row.id));
  expect(histories.size).toBe(500);
  for (const history of histories.values()) expect(history).toEqual([0, 1, 2, 3]);
});
