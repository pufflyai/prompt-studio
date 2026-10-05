import { expect, test } from "bun:test";
import { addAdvancedGroup, normalFilter, setAdvancedGroup } from "./advanced-filter";
import { isCollectionViewDirty } from "./use-collection-views";

test("existing OR views keep their meaning and clean saved state", () => {
  const filter = {
    conjunction: "or" as const,
    rules: [{ attributeId: "status", condition: "is-any-of" as const, value: ["todo"] }],
  };
  const normal = normalFilter(filter);
  expect(normal).toEqual({ conjunction: "and", rules: [], groups: [filter] });
  expect(
    isCollectionViewDirty(
      { id: "all", title: "All", settings: {}, filter, sorts: [] },
      { settings: {}, filter: normal, sorts: [] },
    ),
  ).toBe(false);
  expect(setAdvancedGroup(normal, 0)).toEqual({ conjunction: "and", rules: [] });
});

test("advanced edits mark a view dirty without replacing normal rules", () => {
  const filter = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "contains" as const, value: "chat" }],
  };
  const next = addAdvancedGroup(filter);
  const edited = setAdvancedGroup(next, 0, {
    conjunction: "or",
    rules: [{ attributeId: "status", condition: "is-any-of", value: ["done"] }],
  });
  expect(edited.rules).toEqual(filter.rules);
  expect(
    isCollectionViewDirty(
      { id: "all", title: "All", settings: {}, filter, sorts: [] },
      { settings: {}, filter: edited, sorts: [] },
    ),
  ).toBe(true);
});
