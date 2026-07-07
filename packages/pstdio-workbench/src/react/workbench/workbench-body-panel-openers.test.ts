import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "../terminal/terminal-module";
import { resolveMainBottomPanelOpener } from "./workbench-body";

const placement = (contributionId: string): WorkbenchWidgetPlacement => ({
  widgetId: contributionId,
  contributionId,
});

describe("resolveMainBottomPanelOpener", () => {
  test("uses terminal chrome when the collapsed bottom panel only contains terminal placements", () => {
    expect(
      resolveMainBottomPanelOpener([
        placement(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID),
        placement(WORKBENCH_TERMINAL_WIDGET_ID),
      ]),
    ).toEqual({ label: "Show terminal panel", icon: "SquareTerminal" });
  });

  test("keeps generic bottom panel chrome for mixed content", () => {
    expect(
      resolveMainBottomPanelOpener([placement(WORKBENCH_TERMINAL_WIDGET_ID), placement("workbench.output")]),
    ).toEqual({ label: "Show main-bottom panel", icon: "PanelBottom" });
  });
});
