import { describe, expect, test } from "bun:test";
import type { ExtensionMenuContribution, ExtensionNavigationRecord } from "pstdio-api-contracts";
import {
  buildCommandOutcomeToasts,
  buildExtensionMenuActions,
  buildSlotInvocation,
  type ExtensionMenuActionItem,
  getExtensionNavigationForSlot,
  getExtensionViewsForSlot,
  groupExtensionMenuActions,
} from "./extension-slots";

describe("extension slot helpers", () => {
  test("builds menu actions for one slot", () => {
    const clicked: string[] = [];
    const contributions: ExtensionMenuContribution[] = [
      {
        id: "lab.say-hello:project.headerPrimary",
        extensionId: "pstdio.extension-lab",
        commandId: "lab.say-hello",
        slotId: "project.headerPrimary",
        label: "Lab: Say hello",
        placement: "first",
      },
      {
        id: "lab.counter.bump:project.headerOverflow",
        extensionId: "pstdio.extension-lab",
        commandId: "lab.counter.bump",
        slotId: "project.headerOverflow",
        label: "Bump",
      },
    ];

    const actions = buildExtensionMenuActions({
      slotId: "project.headerPrimary",
      contributions,
      onExecute: (contribution) => clicked.push(contribution.commandId),
    });

    expect(actions).toEqual([
      {
        key: "lab.say-hello:project.headerPrimary",
        label: "Lab: Say hello",
        kind: "extension",
        placement: "first",
        onClick: actions[0]?.onClick,
      },
    ]);
    actions[0]?.onClick();
    expect(clicked).toEqual(["lab.say-hello"]);
  });

  test("groups primary and overflow menu slots by their mounted presentation", () => {
    const actions: ExtensionMenuActionItem[] = [
      {
        key: "lab.say-hello:project.headerPrimary",
        label: "Lab: Say hello",
        kind: "extension" as const,
        onClick: () => undefined,
      },
      {
        key: "lab.counter.bump:project.headerPrimary",
        label: "Bump",
        kind: "extension" as const,
        placement: "last" as const,
        onClick: () => undefined,
      },
    ];

    expect(groupExtensionMenuActions(actions, "button-group")).toEqual({
      primary: actions,
      overflow: [],
    });
    expect(groupExtensionMenuActions(actions, "overflow-menu")).toEqual({
      primary: [],
      overflow: actions,
    });
  });

  test("builds dashboard toasts from command notices and fallback outcomes", () => {
    expect(
      buildCommandOutcomeToasts("Lab: Say hello", {
        ok: true,
        status: "success",
        value: {},
        notices: [{ type: "info", title: "Lab", message: "Hello" }],
      }),
    ).toEqual([{ type: "info", title: "Lab", description: "Hello" }]);

    expect(
      buildCommandOutcomeToasts("Bump lab counter", {
        ok: true,
        status: "success",
        value: {},
      }),
    ).toEqual([{ type: "success", title: "Bump lab counter", description: "Extension command completed." }]);
  });

  test("filters navigation and views by slot id", () => {
    const navigation: ExtensionNavigationRecord[] = [
      {
        id: "lab.page",
        extensionId: "pstdio.extension-lab",
        slotId: "project.sidebarNav",
        label: "Lab",
        route: "lab",
      },
    ];
    const views = [
      {
        id: "lab.sidebar",
        extensionId: "pstdio.extension-lab",
        slotId: "project.sidebar",
        title: "Lab sidebar",
        webview: {
          entry: { kind: "package-asset" as const, path: "./dist/sidebar.js", baseUrl: "file:///tmp/ext.ts" },
        },
      },
    ];

    expect(getExtensionNavigationForSlot(navigation, "project.sidebarNav").map((item) => item.id)).toEqual([
      "lab.page",
    ]);
    expect(getExtensionViewsForSlot(views, "project.sidebar").map((item) => item.id)).toEqual(["lab.sidebar"]);
  });

  test("builds slot invocation context", () => {
    expect(buildSlotInvocation("project.headerPrimary", "menu", { projectId: "p1" })).toEqual({
      id: "project.headerPrimary",
      kind: "menu",
      context: { projectId: "p1" },
    });
  });
});
