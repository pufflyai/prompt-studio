import { describe, expect, test } from "bun:test";
import { closeProjectTab } from "./desktop-project-tabs";

describe("desktop project tab rules", () => {
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
});
