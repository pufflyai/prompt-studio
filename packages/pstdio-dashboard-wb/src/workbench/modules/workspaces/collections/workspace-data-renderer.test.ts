import { describe, expect, test } from "bun:test";
import {
  createWorkspaceRows,
  workspaceDisplayPropertyOptions,
  workspaceFilterCategories,
  workspaceGroupingOptions,
} from "./workspace-data-renderer";

describe("workspace data renderer", () => {
  test("does not expose assignee fields", () => {
    expect(workspaceGroupingOptions.map((option) => option.value)).toEqual(["status", "tag:type", "none"]);
    expect(workspaceDisplayPropertyOptions.map((option) => option.value)).toEqual([
      "id",
      "status",
      "updated",
      "tag:type",
    ]);
    expect(workspaceFilterCategories.map((category) => category.id)).toEqual(["status"]);
    expect(createWorkspaceRows().some((row) => "assignee" in row)).toBe(false);
  });
});
