import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "../terminal/terminal-module";
import { resolveSecondaryPanelOpener } from "./workbench-body";

const placement = (contributionId: string): WorkbenchWidgetPlacement => ({
  widgetId: contributionId,
  contributionId,
});

describe("resolveSecondaryPanelOpener", () => {
  test("uses terminal chrome when the collapsed Secondary Panel only contains terminal placements", () => {
    expect(
      resolveSecondaryPanelOpener([
        placement(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID),
        placement(WORKBENCH_TERMINAL_WIDGET_ID),
      ]),
    ).toEqual({ label: "Show terminal panel", icon: "SquareTerminal" });
  });

  test("keeps generic Secondary Panel chrome for mixed content", () => {
    expect(
      resolveSecondaryPanelOpener([placement(WORKBENCH_TERMINAL_WIDGET_ID), placement("workbench.output")]),
    ).toEqual({ label: "Show Secondary Panel", icon: "PanelBottom" });
  });
});
