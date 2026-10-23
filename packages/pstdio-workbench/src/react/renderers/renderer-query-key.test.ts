import { expect, test } from "bun:test";
import { rendererQueryKey } from "./renderer-query-key";

test("saved view roundtrips preserve query ownership when object fields reorder", () => {
  const first = [
    "owner",
    { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "row" }] },
    { grouping: "status", rowNumbers: true, hiddenColumns: [], columnOrder: ["title", "status"] },
    { page: { owner: "one", scope: "all" } },
  ];
  const restored = [
    "owner",
    { rules: [{ value: "row", condition: "contains", attributeId: "title" }], conjunction: "and" },
    { columnOrder: ["title", "status"], hiddenColumns: [], rowNumbers: true, grouping: "status" },
    { page: { scope: "all", owner: "one" } },
  ];
  expect(rendererQueryKey(first)).toBe(rendererQueryKey(restored));
});

test("query identity preserves ordered fields, sort precedence, and changed values", () => {
  expect(rendererQueryKey({ fields: ["title", "status"] })).not.toBe(rendererQueryKey({ fields: ["status", "title"] }));
  expect(rendererQueryKey({ scope: "one" })).not.toBe(rendererQueryKey({ scope: "two" }));
});
