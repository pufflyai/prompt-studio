import { describe, expect, test } from "bun:test";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { createDashboardWorkbench } from "./workbench";

describe("createDashboardWorkbench", () => {
  test("starts the eligible Side Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.sessionPanel.getMode()).toBe("closed");
  });

  test("starts the Secondary Panel closed", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.panels.isOpen("secondary")).toBe(false);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(false);
  });

  test("registers the host terminal surface and API session opener", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.layout.getWidget(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      region: "secondary",
      title: "Terminal",
      closable: true,
      mountStrategy: "keep-mounted",
      reuse: "none",
      singleton: false,
    });
    expect(workbench.layout.getWidget(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID)).toMatchObject({
      region: "secondary",
      hiddenByDefault: true,
      title: "Terminal",
    });
    expect(workbench.terminal.isAvailable()).toBe(true);
  });
});
