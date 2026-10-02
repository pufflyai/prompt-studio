import { describe, expect, test } from "bun:test";
import {
  legacyFiltersFromViewFilter,
  legacyOrderingFromSorts,
  legacyRuleFor,
  normalizeKanbanViewDefaults,
} from "./collection-view-legacy";

describe("deprecated kanban view fields", () => {
  test("turn into is any of rules and one sort, with the new fields winning", () => {
    const defaults = normalizeKanbanViewDefaults({
      attributes: [
        { id: "status", label: "Status", type: { kind: "enum", options: [] } },
        { id: "tags", label: "Tags", type: { kind: "enum-multi", options: [] } },
      ],
      defaultSettings: { viewMode: "list", ordering: { attributeId: "manual", direction: "asc" } },
      defaultFilters: { status: ["todo"], tags: ["ui"], empty: [] },
      defaultViews: [
        {
          id: "recent",
          title: "Recent",
          settings: {
            viewMode: "board",
            columnGrouping: "status",
            rowGrouping: "none",
            ordering: { attributeId: "updated", direction: "desc" },
            displayProperties: [],
          },
          filters: { status: ["todo"] },
        },
        {
          id: "new",
          title: "New",
          settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] },
          filters: { status: ["todo"] },
          filter: { conjunction: "or", rules: [] },
          sorts: [{ attributeId: "title", direction: "asc" }],
        },
      ],
    });

    expect(defaults.defaultSettings).toEqual({ viewMode: "list" });
    expect(defaults.defaultSorts).toEqual([]);
    expect(defaults.defaultFilter).toEqual({
      conjunction: "and",
      rules: [
        { attributeId: "status", condition: "is-any-of", value: ["todo"] },
        { attributeId: "tags", condition: "has-any-of", value: ["ui"] },
      ],
    });
    expect(defaults.defaultViews?.[0]).toEqual({
      id: "recent",
      title: "Recent",
      settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] },
      filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["todo"] }] },
      sorts: [{ attributeId: "updated", direction: "desc" }],
    });
    expect(defaults.defaultViews?.[1]).toMatchObject({
      filter: { conjunction: "or", rules: [] },
      sorts: [{ attributeId: "title", direction: "asc" }],
    });
  });

  test("exact values on text, number, and date fields become is rules", () => {
    expect(legacyRuleFor("parent", ["PS-100"], "string")).toEqual({
      attributeId: "parent",
      condition: "is",
      value: "PS-100",
    });
    expect(legacyRuleFor("score", ["70", "80"], "number")).toEqual({
      conjunction: "or",
      rules: [
        { attributeId: "score", condition: "is", value: 70 },
        { attributeId: "score", condition: "is", value: 80 },
      ],
    });
    expect(legacyRuleFor("updated", ["2026-09-20T09:00:00.000Z"], "date")).toEqual({
      attributeId: "updated",
      condition: "is",
      value: "2026-09-20",
    });
    expect(legacyRuleFor("owner", ["alex"], undefined)).toEqual({
      attributeId: "owner",
      condition: "is-any-of",
      value: ["alex"],
    });
  });

  test("queries still receive filters and ordering derived from the view", () => {
    expect(
      legacyFiltersFromViewFilter({
        conjunction: "and",
        rules: [
          { attributeId: "archived", condition: "is-any-of", value: ["active"] },
          { attributeId: "archived", condition: "is-any-of", value: ["archived"] },
          { attributeId: "status", condition: "is-none-of", value: ["done"] },
          { attributeId: "tags", condition: "has-any-of", value: [] },
          { conjunction: "or", rules: [{ attributeId: "owner", condition: "is-any-of", value: ["alex"] }] },
        ],
      }),
    ).toEqual({ archived: ["active"] });
    expect(
      legacyFiltersFromViewFilter({
        conjunction: "or",
        rules: [{ attributeId: "archived", condition: "is-any-of", value: ["active"] }],
      }),
    ).toEqual({});
    expect(
      legacyFiltersFromViewFilter({
        conjunction: "and",
        rules: [{ attributeId: "archived", condition: "is-none-of", value: ["active"] }],
      }),
    ).toEqual({});
    expect(legacyOrderingFromSorts([])).toEqual({ attributeId: "manual", direction: "asc" });
    expect(legacyOrderingFromSorts([{ attributeId: "score", direction: "desc" }])).toEqual({
      attributeId: "score",
      direction: "desc",
    });
  });
});
