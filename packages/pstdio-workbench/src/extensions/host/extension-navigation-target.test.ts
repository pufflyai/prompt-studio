import { describe, expect, test } from "bun:test";
import { isExtensionNavigationTarget, toWorkbenchNavigationTarget } from "./extension-navigation-target";

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
        { extensionId: "pstdio.planner" },
      ),
    ).toEqual({
      kind: "panel",
      panel: { extensionId: "pstdio.planner", kind: "placement", id: "inspector" },
      resource: { type: "ticket", id: "PS-1", label: "Ticket" },
      open: "preview",
    });
  });
});

describe("isExtensionNavigationTarget", () => {
  test("accepts one leading page followed by a panel in a compound target", () => {
    expect(
      isExtensionNavigationTarget({
        kind: "compound",
        targets: [
          { kind: "page", page: { kind: "page", id: "ticket" } },
          { kind: "panel", panel: { kind: "placement", id: "session" } },
        ],
      }),
    ).toBe(true);
  });

  test("rejects a page after another compound action", () => {
    expect(
      isExtensionNavigationTarget({
        kind: "compound",
        targets: [
          { kind: "panel", panel: { kind: "placement", id: "session" } },
          { kind: "page", page: { kind: "page", id: "ticket" } },
        ],
      }),
    ).toBe(false);
  });
});
