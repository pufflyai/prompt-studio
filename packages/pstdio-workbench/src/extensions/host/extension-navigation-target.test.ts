import { describe, expect, test } from "bun:test";
import { isNavigationTarget } from "@pstdio/sdk/extensions";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";

describe("toWorkbenchNavigationTarget", () => {
  test("keeps host command references in the host command namespace", () => {
    expect(
      toWorkbenchNavigationTarget({
        kind: "command",
        target: {
          command: { extensionId: "pstdio", kind: "command", id: "workbench.action.openSettings" },
        },
      }),
    ).toEqual({
      kind: "command",
      commandId: "workbench.action.openSettings",
      args: undefined,
    });
  });

  test("normalizes a page target to the calling extension", () => {
    expect(
      toWorkbenchNavigationTarget(
        {
          kind: "page",
          page: { kind: "page", id: "lab" },
        },
        { extensionId: "pstdio.extension-lab" },
      ),
    ).toEqual({
      kind: "page",
      page: { extensionId: "pstdio.extension-lab", kind: "page", id: "lab" },
    });
  });

  test("normalizes a placement panel target to the calling extension", () => {
    expect(
      toWorkbenchNavigationTarget(
        {
          kind: "panel",
          panel: { kind: "placement", id: "inspector" },
          resource: { type: "ticket", id: "PS-1", label: "Ticket" },
          open: "preview",
        },
        { extensionId: "pstdio.planner", projectId: "project" },
      ),
    ).toEqual({
      kind: "panel",
      panel: { extensionId: "pstdio.planner", kind: "placement", id: "inspector" },
      resource: { type: "ticket", id: "PS-1", label: "Ticket", extensionId: "pstdio.planner", projectId: "project" },
      open: "preview",
    });
  });
});

describe("isNavigationTarget", () => {
  test("accepts one leading page followed by a panel in a compound target", () => {
    expect(
      isNavigationTarget({
        kind: "compound",
        targets: [
          { kind: "page", page: { kind: "page", id: "ticket" } },
          { kind: "panel", panel: { kind: "placement", id: "session" } },
        ],
      }),
    ).toBe(true);
  });

  test("accepts page and panel actions in any order", () => {
    expect(
      isNavigationTarget({
        kind: "compound",
        targets: [
          { kind: "panel", panel: { kind: "placement", id: "session" } },
          { kind: "page", page: { kind: "page", id: "ticket" } },
        ],
      }),
    ).toBe(true);
  });
});
