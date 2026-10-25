import { expect, test } from "bun:test";
import { retainSelectedRows } from "./data-table-selection";

test("selection keeps only chosen row values across provider pages", () => {
  const first = { title: "First" };
  const second = { title: "Second" };
  const selected = retainSelectedRows(new Map(), { first: true }, new Map([["first", first]]));
  const next = retainSelectedRows(selected, { first: true, second: true }, new Map([["second", second]]));
  expect([...next.values()]).toEqual([first, second]);
  expect([...retainSelectedRows(next, { second: true }, new Map()).values()]).toEqual([second]);
});
