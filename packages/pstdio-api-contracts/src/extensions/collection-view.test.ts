import { describe, expect, test } from "bun:test";
import {
  findViewFilterProblem,
  findViewSortsProblem,
  NESTED_GROUP_PROBLEM,
  type ViewRuleField,
  viewFilterGroupSchema,
} from "./collection-view";

const fields: ViewRuleField[] = [
  { id: "title", kind: "string", filterable: true, sortable: true },
  { id: "score", kind: "number", filterable: true, sortable: true },
  { id: "updated", kind: "date", filterable: true, sortable: true },
  {
    id: "status",
    kind: "status",
    filterable: true,
    sortable: true,
    options: [{ value: "todo" }, { value: "done" }],
  },
  { id: "tags", kind: "enum-multi", filterable: true, sortable: true, options: [{ value: "ui" }] },
  { id: "owner", kind: "user", filterable: false, sortable: false },
];

const filterOf = (rules: Parameters<typeof findViewFilterProblem>[0]["rules"]) => ({
  conjunction: "and" as const,
  rules,
});

describe("view filter validation", () => {
  test("accepts rules that fit each field kind", () => {
    const filter = filterOf([
      { attributeId: "title", condition: "contains", value: "chat" },
      { attributeId: "score", condition: "gte", value: 70 },
      { attributeId: "updated", condition: "is-after", value: "today-7" },
      { attributeId: "status", condition: "is-none-of", value: ["done"] },
      {
        conjunction: "or",
        rules: [
          { attributeId: "tags", condition: "has-any-of", value: ["ui"] },
          { attributeId: "updated", condition: "is-empty" },
        ],
      },
    ]);

    expect(findViewFilterProblem(filter, fields)).toBeUndefined();
  });

  test("lists the conditions a field accepts", () => {
    const problem = findViewFilterProblem(
      filterOf([{ attributeId: "score", condition: "contains", value: "7" }]),
      fields,
    );

    expect(problem).toBe(
      'Field "score" does not accept "contains". Valid conditions: is, is-not, gt, gte, lt, lte, is-empty, is-not-empty',
    );
  });

  test("lists the fields that allow filtering", () => {
    expect(findViewFilterProblem(filterOf([{ attributeId: "owner", condition: "is-empty" }]), fields)).toContain(
      "Valid IDs: title, score, updated, status, tags",
    );
  });

  test("lists the option values of a field", () => {
    expect(
      findViewFilterProblem(filterOf([{ attributeId: "status", condition: "is-any-of", value: ["gone"] }]), fields),
    ).toContain("Valid values: todo, done");
  });

  test("checks the value against the condition", () => {
    expect(
      findViewFilterProblem(filterOf([{ attributeId: "score", condition: "gt", value: "seventy" }]), fields),
    ).toContain("needs a number");
    expect(
      findViewFilterProblem(filterOf([{ attributeId: "updated", condition: "is", value: "last week" }]), fields),
    ).toContain("needs a day");
    expect(
      findViewFilterProblem(filterOf([{ attributeId: "title", condition: "is-empty", value: "x" }]), fields),
    ).toContain("takes no value");
  });

  test("keeps rules that are still being built", () => {
    expect(findViewFilterProblem(filterOf([{ attributeId: "score", condition: "gt" }]), fields)).toBeUndefined();
  });

  test("refuses a group inside a nested group", () => {
    const filter = filterOf([
      { conjunction: "or", rules: [{ conjunction: "and", rules: [{ attributeId: "title", condition: "is-empty" }] }] },
    ]);

    expect(findViewFilterProblem(filter, fields)).toBe(NESTED_GROUP_PROBLEM);
    expect(viewFilterGroupSchema.safeParse(filter).error?.issues[0]?.message).toBe(NESTED_GROUP_PROBLEM);
  });
});

describe("view sort validation", () => {
  test("lists the sortable fields", () => {
    expect(findViewSortsProblem([{ attributeId: "tags", direction: "asc" }], fields)).toBe(
      'Invalid sort field "tags". Valid IDs: title, score, updated, status',
    );
  });

  test("refuses a field sorted twice", () => {
    expect(
      findViewSortsProblem(
        [
          { attributeId: "score", direction: "asc" },
          { attributeId: "score", direction: "desc" },
        ],
        fields,
      ),
    ).toContain("more than once");
  });
});
