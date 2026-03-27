import { describe, expect, it } from "bun:test";
import { filterSearchableMenuItems } from "./searchable-menu";

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
