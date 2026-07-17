import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "../terminal/terminal-module";
import { resolveFrameOpeners, resolveMainBottomPanelOpener } from "./frame-openers";

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

describe("resolveFrameOpeners", () => {
  test("keeps classic opener order independent of frame traversal order", () => {
    expect(
      resolveFrameOpeners({
        panels: {
          "main-right": { available: true, collapsed: true, collapsible: true, placements: [] },
          secondary: {
            available: true,
            collapsed: true,
            collapsible: true,
            placements: [placement(WORKBENCH_TERMINAL_WIDGET_ID)],
          },
          "main-left": { available: true, collapsed: true, collapsible: true, placements: [] },
        },
      }),
    ).toEqual([
      { id: "main-left", label: "Show main-left panel", icon: "PanelLeft" },
      { id: "secondary", label: "Show terminal panel", icon: "SquareTerminal" },
      { id: "main-right", label: "Show main-right panel", icon: "PanelRight" },
    ]);
  });

  test("only returns collapsed collapsible panels", () => {
    expect(
      resolveFrameOpeners({
        panels: {
          "main-left": { available: true, collapsed: false, collapsible: true, placements: [] },
          secondary: { available: true, collapsed: true, collapsible: false, placements: [] },
        },
      }),
    ).toEqual([]);
  });

  test("does not reveal an unavailable companion panel", () => {
    expect(
      resolveFrameOpeners({
        panels: {
          "main-left": {
            available: false,
            collapsed: true,
            collapsible: true,
            placements: [],
          },
        },
      }),
    ).toEqual([]);
  });
});
