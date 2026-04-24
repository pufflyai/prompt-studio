import { describe, expect, it } from "bun:test";

import {
  DEFAULT_DISPLAY_PROPERTY_OPTIONS,
  type GroupingField,
  type WorkspaceFilterCategory,
  type WorkspaceOption,
} from "./types";
import {
  orderGroupingOptions,
  resolveKnownColumnKeys,
  resolveListDropTargetColumnKey,
  resolveSubGroupingOptions,
} from "./workspace-helpers";

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

  it("uses active status filters to hide filtered-out primary groups", () => {
    const result = resolveKnownColumnKeys("status", ["todo", "in_progress", "done"], categories, {
      status: ["todo", "done"],
    });

    expect(result).toEqual(["todo", "done"]);
  });
});

describe("orderGroupingOptions", () => {
  it("moves no-grouping to the top", () => {
    const options: WorkspaceOption<"status" | "assignee" | "none">[] = [
      { value: "status", label: "Status" },
      { value: "assignee", label: "Assignee" },
      { value: "none", label: "No grouping" },
    ];

    const ordered = orderGroupingOptions(options);

    expect(ordered.map((option) => option.value)).toEqual(["none", "status", "assignee"]);
  });
});

describe("resolveSubGroupingOptions", () => {
  const options: WorkspaceOption<GroupingField>[] = [
    { value: "status", label: "Status" },
    { value: "assignee", label: "Assignee" },
    { value: "none", label: "No grouping" },
  ];

  it("limits sub-grouping to none when primary grouping is none", () => {
    const result = resolveSubGroupingOptions(options, "none");

    expect(result.map((option) => option.value)).toEqual(["none"]);
  });

  it("excludes primary grouping value for non-none primary grouping", () => {
    const result = resolveSubGroupingOptions(options, "status");

    expect(result.map((option) => option.value)).toEqual(["assignee", "none"]);
  });
});

describe("resolveListDropTargetColumnKey", () => {
  it("returns a drop target for ungrouped lists", () => {
    expect(resolveListDropTargetColumnKey("none")).toBe("all");
  });

  it("uses placement column for grouped lists", () => {
    expect(resolveListDropTargetColumnKey("status", { columnKey: "todo" })).toBe("todo");
  });
});

describe("DEFAULT_DISPLAY_PROPERTY_OPTIONS", () => {
  it("does not include assignee in default fields", () => {
    expect(DEFAULT_DISPLAY_PROPERTY_OPTIONS.map((option) => option.value)).toEqual(["id", "status", "updated"]);
  });
});
