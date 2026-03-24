import { describe, expect, it } from "bun:test";
import { resolveProjectDefaultPath } from "./project-default-path";

describe("resolveProjectDefaultPath", () => {
  it("returns the tickets page when a project id is provided", () => {
    expect(resolveProjectDefaultPath("p1")).toBe("/projects/p1/tickets");
  });

  it("falls back to the projects index when a project id is missing", () => {
    expect(resolveProjectDefaultPath()).toBe("/projects");
  });
});
