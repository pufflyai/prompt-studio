import { expect, test } from "bun:test";
import { findViewFilterProblem, viewFilterGroupSchema } from "./collection-view";

test("boolean filters accept false as a value and reject option lists", () => {
  const filter = {
    conjunction: "and" as const,
    rules: [{ attributeId: "archived", condition: "is" as const, value: false }],
  };
  expect(viewFilterGroupSchema.safeParse(filter).success).toBe(true);
  const fields = [{ id: "archived", kind: "boolean" as const, filterable: true, sortable: true }];
  expect(findViewFilterProblem(filter, fields)).toBeUndefined();
  expect(findViewFilterProblem({ ...filter, rules: [{ ...filter.rules[0]!, value: ["active"] }] }, fields)).toContain(
    "needs a boolean",
  );
});
