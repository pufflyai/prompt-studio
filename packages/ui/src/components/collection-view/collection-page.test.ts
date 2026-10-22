import { expect, test } from "bun:test";
import { applyPageGroupCounts } from "./collection-page";

test("page groups retain off-page counts without loading their rows", () => {
  const field = { id: "status", label: "Status", type: { kind: "string" as const } };
  const groups = [
    { key: "ready", label: "ready", rows: [{ id: "one", title: "One", attributes: { status: "ready" } }] },
  ];
  const counts = [
    { field: "status", value: "ready", count: 125 },
    { field: "status", value: "done", count: 75 },
  ];
  const result = applyPageGroupCounts(groups, counts, field);
  expect(result.map((group) => [group.key, group.count, group.rows.length])).toEqual([
    ["done", 75, 0],
    ["ready", 125, 1],
  ]);
});

test("subgroup counts stay within their parent column", () => {
  const field = { id: "team", label: "Team", type: { kind: "string" as const } };
  const parent = { id: "status", label: "Status", type: { kind: "string" as const } };
  const counts = [
    { field: "team", value: "one", count: 10, parent: { field: "status", value: "ready" } },
    { field: "team", value: "one", count: 90, parent: { field: "status", value: "done" } },
  ];
  expect(applyPageGroupCounts([], counts, field, { field: parent, key: "ready" })[0].count).toBe(10);
});
