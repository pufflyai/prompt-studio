import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { resolveRenderedRegionPlacements } from "./region";

const placement = (overrides: Partial<WorkbenchWidgetPlacement>): WorkbenchWidgetPlacement => ({
  widgetId: overrides.widgetId ?? "widget",
  contributionId: overrides.contributionId ?? "contribution",
  ...overrides,
});

describe("resolveRenderedRegionPlacements", () => {
  test("keeps inactive keep-mounted placements in the render set", () => {
    const active = placement({ widgetId: "active" });
    const inactiveTerminal = placement({ widgetId: "terminal", mountStrategy: "keep-mounted" });
    const inactivePlain = placement({ widgetId: "plain" });

    expect(resolveRenderedRegionPlacements([active, inactiveTerminal, inactivePlain], "active", "main")).toEqual([
      active,
      inactiveTerminal,
    ]);
  });

  test("renders every Sidenav placement in composition order", () => {
    const modeSection = placement({ widgetId: "mode-sessions" });
    const pageSection = placement({ widgetId: "page-emoji-editor" });

    expect(resolveRenderedRegionPlacements([modeSection, pageSection], "page-emoji-editor", "sidenav")).toEqual([
      modeSection,
      pageSection,
    ]);
  });
});
