import { expect, test } from "bun:test";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { filterRowsByView } from "./collection-view-filter";
import { normalizeBooleanViewFilter } from "./normalize-boolean-view-filter";

const fields: AttributeDescriptor[] = [
  { id: "archived", label: "Archived", type: { kind: "boolean" }, filterable: true },
];
const rows = [true, false, undefined, "false"].map((value, index) => ({
  id: String(index),
  title: String(index),
  attributes: { archived: value },
}));
test("boolean predicates compare actual truth values", () => {
  const select = (condition: "is" | "is-not", value: boolean) =>
    filterRowsByView(rows, { conjunction: "and", rules: [{ attributeId: "archived", condition, value }] }, fields).map(
      (row) => row.id,
    );
  expect(select("is", true)).toEqual(["0"]);
  expect(select("is", false)).toEqual(["1"]);
  expect(select("is-not", true)).toEqual(["1", "2"]);
  expect(select("is-not", false)).toEqual(["0", "2"]);
});

test("saved boolean rules normalize inside groups and preserve both-value predicates", () => {
  const migratedFields: AttributeDescriptor[] = [
    { ...fields[0]!, type: { kind: "boolean", legacyValues: { active: false, archived: true } } },
  ];
  const filter = {
    conjunction: "or" as const,
    rules: [
      { attributeId: "archived", condition: "is-none-of" as const, value: ["active", "archived"] },
      {
        conjunction: "and" as const,
        rules: [{ attributeId: "archived", condition: "is-any-of" as const, value: ["active"] }],
      },
    ],
  };
  const normalized = normalizeBooleanViewFilter(filter, migratedFields);
  expect(normalized.rules[0]).toEqual({ attributeId: "archived", condition: "is-empty" });
  expect(normalized.rules[1]).toEqual({
    conjunction: "and",
    rules: [{ attributeId: "archived", condition: "is", value: false }],
  });
  const tickets = rows.slice(0, 2);
  expect(filterRowsByView(tickets, filter, migratedFields).map((row) => row.id)).toEqual(["1"]);
  expect(normalizeBooleanViewFilter(normalized, migratedFields)).toBe(normalized);
});
