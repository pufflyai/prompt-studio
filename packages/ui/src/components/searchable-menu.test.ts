import { describe, expect, it } from "bun:test";
import { filterSearchableMenuItems, resolveActiveListConfig, shouldResetSearchableMenuQuery } from "./searchable-menu";

const items = [
  { id: "main", label: "main" },
  { id: "feature/api-stream", label: "feature/api-stream", searchText: "origin/feature/api-stream" },
  { id: "post-session-await-input", label: "post-session-await-input", searchText: "Session waiting for input" },
];

describe("filterSearchableMenuItems", () => {
  it("returns all items when query is empty", () => {
    expect(filterSearchableMenuItems(items, "")).toEqual(items);
    expect(filterSearchableMenuItems(items, "   ")).toEqual(items);
  });

  it("filters items by label with case-insensitive matching", () => {
    expect(filterSearchableMenuItems(items, "API")).toEqual([
      { id: "feature/api-stream", label: "feature/api-stream", searchText: "origin/feature/api-stream" },
    ]);
  });

  it("filters items by additional search text", () => {
    expect(filterSearchableMenuItems(items, "waiting")).toEqual([
      {
        id: "post-session-await-input",
        label: "post-session-await-input",
        searchText: "Session waiting for input",
      },
    ]);
  });
});

describe("shouldResetSearchableMenuQuery", () => {
  it("resets search when the active list changes", () => {
    expect(shouldResetSearchableMenuQuery("branches", "repos")).toBe(true);
  });

  it("keeps search when the active list stays the same or list switching is not tracked", () => {
    expect(shouldResetSearchableMenuQuery("branches", "branches")).toBe(false);
    expect(shouldResetSearchableMenuQuery(undefined, "branches")).toBe(false);
    expect(shouldResetSearchableMenuQuery("branches", undefined)).toBe(false);
  });
});

const childConfig = {
  items,
  filterItems: (i: typeof items) => i,
  showSearch: true,
  searchPlaceholder: "Search…",
  emptyState: "No results",
  contentTestId: "child-test-id",
  closeOnSelect: true,
  listId: "child",
};

describe("resolveActiveListConfig", () => {
  it("returns child config when not showing parent", () => {
    const result = resolveActiveListConfig(false, undefined, childConfig);
    expect(result).toBe(childConfig);
  });

  it("returns child config when parentList is undefined", () => {
    const result = resolveActiveListConfig(true, undefined, childConfig);
    expect(result).toBe(childConfig);
  });

  it("returns parent config with fallbacks to child defaults", () => {
    const parentItems = [{ id: "repo-1", label: "repo-1" }];
    const result = resolveActiveListConfig(true, { items: parentItems, selectedLabel: "repo-1" }, childConfig);

    expect(result.items).toEqual(parentItems);
    expect(result.filterItems).toBe(childConfig.filterItems);
    expect(result.showSearch).toBe(childConfig.showSearch);
    expect(result.searchPlaceholder).toBe(childConfig.searchPlaceholder);
    expect(result.emptyState).toBe(childConfig.emptyState);
    expect(result.contentTestId).toBe(childConfig.contentTestId);
    expect(result.closeOnSelect).toBe(false);
    expect(result.listId).toBe("parent");
  });

  it("uses parent overrides when provided", () => {
    const parentItems = [{ id: "repo-1", label: "repo-1" }];
    const result = resolveActiveListConfig(
      true,
      {
        items: parentItems,
        selectedLabel: "repo-1",
        showSearch: false,
        searchPlaceholder: "Search repos…",
        emptyState: "No repos",
        contentTestId: "parent-test-id",
      },
      childConfig,
    );

    expect(result.showSearch).toBe(false);
    expect(result.searchPlaceholder).toBe("Search repos…");
    expect(result.emptyState).toBe("No repos");
    expect(result.contentTestId).toBe("parent-test-id");
  });
});
