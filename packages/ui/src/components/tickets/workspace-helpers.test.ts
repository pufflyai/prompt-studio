import { describe, expect, it } from "bun:test";

import { DEFAULT_DISPLAY_PROPERTY_OPTIONS, type WorkspaceFilterCategory } from "./types";
import { resolveKnownColumnKeys } from "./workspace-helpers";

const categories: WorkspaceFilterCategory[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "todo", label: "Todo" },
      { value: "done", label: "Done" },
    ],
  },
  {
    id: "assignee",
    label: "Assignee",
    options: [
      { value: "Alex", label: "Alex" },
      { value: "Sam", label: "Sam" },
    ],
  },
];

describe("resolveKnownColumnKeys", () => {
  it("keeps explicit known columns for status grouping", () => {
    const result = resolveKnownColumnKeys("status", ["todo", "in_progress", "done"], categories);

    expect(result).toEqual(["todo", "in_progress", "done"]);
  });

  it("does not reuse status columns for non-status grouping", () => {
    const result = resolveKnownColumnKeys("assignee", ["todo", "in_progress", "done"], categories);

    expect(result).toEqual(["Alex", "Sam"]);
  });
});

describe("DEFAULT_DISPLAY_PROPERTY_OPTIONS", () => {
  it("does not include assignee in default fields", () => {
    expect(DEFAULT_DISPLAY_PROPERTY_OPTIONS.map((option) => option.value)).toEqual(["id", "status", "updated"]);
  });
});
