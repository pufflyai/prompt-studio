import { describe, expect, test } from "bun:test";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { createDashboardWorkbench } from "./workbench";

describe("createDashboardWorkbench", () => {
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
