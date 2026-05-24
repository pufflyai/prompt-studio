import { describe, expect, test } from "bun:test";
import { isEnumOptionsSource } from "@pstdio/ui";
import { createWorkspaceAttributes, createWorkspaceRows, workspaceDefaultSettings } from "./workspace-data-renderer";

const stubContext = () => ({
  context: {
    get: () => undefined,
    store: {
      subscribeSelector: () => () => {},
    },
  } as never,
});

describe("workspace data renderer", () => {
  test("declares the canonical attribute set without assignee", () => {
    const attributeIds = createWorkspaceAttributes(stubContext()).map((attribute) => attribute.id);
    expect(attributeIds).toEqual(["id", "status", "type", "updated", "diffOverview"]);
    expect(attributeIds).not.toContain("assignee");
  });

  test("workspace rows do not expose an assignee attribute", () => {
    for (const row of createWorkspaceRows()) {
      expect(row.attributes).not.toHaveProperty("assignee");
    }
  });

  test("status attribute is filterable, groupable, and source-driven", () => {
    const status = createWorkspaceAttributes(stubContext()).find((attribute) => attribute.id === "status");
    expect(status?.filterable).toBe(true);
    expect(status?.groupable).toBe(true);
    if (status?.type.kind !== "enum") throw new Error("expected enum kind");
    expect(isEnumOptionsSource(status.type.options)).toBe(true);
  });

  test("diff overview uses a custom renderer and is displayed by default", () => {
    const attributes = createWorkspaceAttributes(stubContext());
    const diffOverview = attributes.find((attribute) => attribute.id === "diffOverview");

    expect(diffOverview?.displayable).toBe(true);
    expect(workspaceDefaultSettings.displayProperties).toContain("diffOverview");
    expect(typeof diffOverview?.render).toBe("function");
    expect(
      diffOverview?.render?.("+8 -2", {
        id: "workspace-1",
        title: "Workspace",
        attributes: { diffOverview: "+8 -2", diffAdditions: 8, diffDeletions: 2 },
      }),
    ).not.toBeNull();
  });
});
