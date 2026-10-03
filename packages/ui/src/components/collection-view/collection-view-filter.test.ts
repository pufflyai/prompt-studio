import { describe, expect, test } from "bun:test";
import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";
import { TITLE_FIELD, withTitleField } from "./collection-view-fields";
import { countFilterRules, filterRowsByView, resolveViewDay } from "./collection-view-filter";

const fields: AttributeDescriptor[] = withTitleField([
  { id: "score", label: "Score", type: { kind: "number" }, filterable: true },
  { id: "updated", label: "Updated", type: { kind: "date" }, filterable: true },
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo" },
        { value: "done", label: "Done" },
      ],
    },
    filterable: true,
  },
  { id: "tags", label: "Tags", type: { kind: "enum-multi", options: [] }, filterable: true },
  { id: "owner", label: "Owner", type: { kind: "user" }, filterable: true },
]);

const row = (id: string, title: string, attributes: Record<string, unknown>): KanbanRendererRow => ({
  id,
  title,
  attributes,
});

const rows = [
  row("a", "Improve chat tables", {
    score: 92,
    updated: "2026-10-01T09:00:00",
    status: "todo",
    tags: ["ui", "chat"],
    owner: "alex",
  }),
  row("b", "Chat scroll jumps", { score: 55, updated: "2026-09-20T09:00:00", status: "done", tags: ["chat"] }),
  row("c", "Harness params", { score: "70", status: "todo", tags: [] }),
];

const today = new Date(2026, 9, 2);
const idsFor = (filter: ViewFilterGroup) => filterRowsByView(rows, filter, fields, today).map((entry) => entry.id);
const only = (rule: ViewFilterRule) => idsFor({ conjunction: "and", rules: [rule] });

describe("view filters", () => {
  test("text conditions ignore case", () => {
    expect(only({ attributeId: "title", condition: "contains", value: "CHAT" })).toEqual(["a", "b"]);
    expect(only({ attributeId: "title", condition: "does-not-contain", value: "chat" })).toEqual(["c"]);
    expect(only({ attributeId: "title", condition: "is", value: "harness params" })).toEqual(["c"]);
    expect(only({ attributeId: "title", condition: "is-not", value: "harness params" })).toEqual(["a", "b"]);
  });

  test("number conditions compare numbers, including numeric text", () => {
    expect(only({ attributeId: "score", condition: "gte", value: 70 })).toEqual(["a", "c"]);
    expect(only({ attributeId: "score", condition: "gt", value: 70 })).toEqual(["a"]);
    expect(only({ attributeId: "score", condition: "lt", value: 70 })).toEqual(["b"]);
    expect(only({ attributeId: "score", condition: "lte", value: 55 })).toEqual(["b"]);
    expect(only({ attributeId: "score", condition: "is", value: 70 })).toEqual(["c"]);
    expect(only({ attributeId: "score", condition: "is-not", value: 70 })).toEqual(["a", "b"]);
  });

  test("date conditions compare days, and relative days follow today", () => {
    expect(only({ attributeId: "updated", condition: "is", value: "2026-10-01" })).toEqual(["a"]);
    expect(only({ attributeId: "updated", condition: "is-after", value: "today-7" })).toEqual(["a"]);
    expect(only({ attributeId: "updated", condition: "is-before", value: "today-7" })).toEqual(["b"]);
    expect(only({ attributeId: "updated", condition: "is-on-or-before", value: "2026-09-20" })).toEqual(["b"]);
    expect(only({ attributeId: "updated", condition: "is-on-or-after", value: "2026-09-20" })).toEqual(["a", "b"]);
    expect(resolveViewDay("today+1", today)).toBe(20_261_003);
    expect(resolveViewDay("today-2", new Date(2026, 0, 1))).toBe(20_251_230);
  });

  test("date-only values and timestamps name a day on the viewer's calendar", () => {
    const dated = [row("d", "Day only", { updated: "2026-10-02" }), row("e", "Stamp", { updated: today.getTime() })];
    const filter: ViewFilterGroup = {
      conjunction: "and",
      rules: [{ attributeId: "updated", condition: "is", value: "today" }],
    };
    expect(filterRowsByView(dated, filter, fields, today).map((entry) => entry.id)).toEqual(["d", "e"]);
  });

  test("option conditions compare value ids", () => {
    expect(only({ attributeId: "status", condition: "is-any-of", value: ["done"] })).toEqual(["b"]);
    expect(only({ attributeId: "status", condition: "is-none-of", value: ["done"] })).toEqual(["a", "c"]);
    expect(only({ attributeId: "owner", condition: "is-any-of", value: ["alex"] })).toEqual(["a"]);
  });

  test("multi-value conditions look at every value", () => {
    expect(only({ attributeId: "tags", condition: "has-any-of", value: ["ui"] })).toEqual(["a"]);
    expect(only({ attributeId: "tags", condition: "has-all-of", value: ["ui", "chat"] })).toEqual(["a"]);
    expect(only({ attributeId: "tags", condition: "has-none-of", value: ["ui"] })).toEqual(["b", "c"]);
    expect(only({ attributeId: "tags", condition: "is-any-of", value: ["chat"] })).toEqual(["a", "b"]);
  });

  test("empty conditions take no value", () => {
    expect(only({ attributeId: "updated", condition: "is-empty" })).toEqual(["c"]);
    expect(only({ attributeId: "tags", condition: "is-not-empty" })).toEqual(["a", "b"]);
    expect(only({ attributeId: "owner", condition: "is-empty" })).toEqual(["b", "c"]);
  });

  test("all rules use the selected conjunction", () => {
    const rules: ViewFilterRule[] = [
      { attributeId: "status", condition: "is-none-of", value: ["done"] },
      { attributeId: "owner", condition: "is-any-of", value: ["alex"] },
      { attributeId: "score", condition: "gte", value: 70 },
    ];
    expect(idsFor({ conjunction: "and", rules })).toEqual(["a"]);
    expect(idsFor({ conjunction: "or", rules })).toEqual(["a", "c"]);
    expect(countFilterRules({ conjunction: "and", rules })).toBe(3);
  });

  test("rules still being built or no longer fitting a field never hide rows", () => {
    expect(only({ attributeId: "score", condition: "gt" })).toEqual(["a", "b", "c"]);
    expect(only({ attributeId: "status", condition: "is-any-of", value: [] })).toEqual(["a", "b", "c"]);
    expect(only({ attributeId: "gone", condition: "is-empty" })).toEqual(["a", "b", "c"]);
    expect(only({ attributeId: "score", condition: "contains", value: "9" })).toEqual(["a", "b", "c"]);
  });

  test("old exact-value lists keep matching text and number fields", () => {
    expect(only({ attributeId: "title", condition: "is-any-of", value: ["Harness params"] })).toEqual(["c"]);
    expect(only({ attributeId: "title", condition: "is-any-of", value: ["harness params"] })).toEqual([]);
    expect(only({ attributeId: "updated", condition: "is-any-of", value: ["2026-10-01T09:00:00"] })).toEqual(["a"]);
    expect(only({ attributeId: "updated", condition: "is-any-of", value: ["2026-10-01T10:00:00"] })).toEqual([]);
    expect(only({ attributeId: "score", condition: "is-any-of", value: ["92", "70"] })).toEqual(["a", "c"]);
  });

  test("excluded exact scalar selections preserve case and timestamps", () => {
    expect(only({ attributeId: "title", condition: "is-none-of", value: ["Chat scroll jumps"] })).toEqual(["a", "c"]);
    expect(only({ attributeId: "updated", condition: "is-none-of", value: ["2026-10-01T09:00:00"] })).toEqual([
      "b",
      "c",
    ]);
  });

  test("the built-in title field reads the row title", () => {
    expect(filterRowsByView(rows, { conjunction: "and", rules: [] }, [TITLE_FIELD])).toBe(rows);
    expect(only({ attributeId: "title", condition: "is-empty" })).toEqual([]);
  });
});
