import { describe, expect, test } from "bun:test";
import { closeProjectTab, openProjectTab, reconcileProjectTabs } from "./desktop-project-tabs";

describe("desktop project tab rules", () => {
  test("opens projects in order and activates existing tabs without duplicates", () => {
    const opened = openProjectTab(["first"], "second");
    expect(opened).toEqual(["first", "second"]);
    expect(openProjectTab(opened, "first")).toBe(opened);
  });

  test("closing an inactive tab keeps the selected project", () => {
    expect(closeProjectTab(["first", "second", "third"], "second", "first")).toEqual({
      projectIds: ["first", "third"],
      selectedProjectId: "first",
    });
  });

  test("closing the active tab selects its next neighbor, then the previous at the end", () => {
    expect(closeProjectTab(["first", "second", "third"], "second", "second")).toEqual({
      projectIds: ["first", "third"],
      selectedProjectId: "third",
    });
    expect(closeProjectTab(["first", "third"], "third", "third")).toEqual({
      projectIds: ["first"],
      selectedProjectId: "first",
    });
    expect(closeProjectTab(["first"], "first", "first")).toEqual({ projectIds: [], selectedProjectId: undefined });
  });

  test("removes deleted IDs without changing the remaining order", () => {
    expect(reconcileProjectTabs(["third", "deleted", "first"], ["first", "second", "third"])).toEqual([
      "third",
      "first",
    ]);
  });
});
