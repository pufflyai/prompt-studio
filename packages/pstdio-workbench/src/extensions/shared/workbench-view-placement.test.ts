import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { resolveWorkbenchViewWidgetPlacement } from "./workbench-targets";

type ViewRecord = WorkbenchExtensionMetadata["views"][number];

describe("resolveWorkbenchViewWidgetPlacement", () => {
  test("places a menu with its host view and preserves the binding", () => {
    const host = {
      id: "lab.editor",
      extensionId: "pstdio.lab",
      slotId: "editor",
      title: "Editor",
      target: "workbench.main.right",
    } satisfies ViewRecord;
    const menu = {
      id: "lab.properties",
      extensionId: "pstdio.lab",
      slotId: "properties",
      title: "Properties",
      target: "workbench.secondary",
      menu: { host: "lab.editor", side: "right", icon: "sliders-horizontal" },
    } satisfies ViewRecord;

    expect(resolveWorkbenchViewWidgetPlacement(menu, [host, menu])).toEqual({
      area: "main",
      menu: { host: "lab.editor", side: "right", icon: "sliders-horizontal" },
    });
  });

  test("treats main side targets as panel menu regions", () => {
    const view = {
      id: "lab.outline",
      extensionId: "pstdio.lab",
      slotId: "outline",
      title: "Outline",
      target: "workbench.main.left",
    } satisfies ViewRecord;

    expect(resolveWorkbenchViewWidgetPlacement(view, [view])).toEqual({
      area: "main",
      menu: { host: "*", side: "left", icon: "panel-left" },
    });
  });

  test("uses the view target when it is not a menu", () => {
    const view = {
      id: "lab.output",
      extensionId: "pstdio.lab",
      slotId: "output",
      title: "Output",
      target: "workbench.secondary",
    } satisfies ViewRecord;

    expect(resolveWorkbenchViewWidgetPlacement(view, [view])).toEqual({
      area: "secondary",
      menu: undefined,
    });
  });
});
